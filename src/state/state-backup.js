/**
 * State Safety backup and lifecycle-log helpers for Saga.
 */

import { safeJsonSize, stripRetiredStateHistoryFields } from './storage-safety.js';

const STATE_SAFETY_BACKUP_LIMIT = 6;
const STATE_SAFETY_MIGRATION_LOG_LIMIT = 30;

export function cloneJsonForStateSafety(value, fallback = null) {
    try {
        if (value === undefined) return fallback;
        return JSON.parse(JSON.stringify(value));
    } catch (_e) {
        return fallback;
    }
}

export function normalizeStateSafety(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const backups = Array.isArray(input.backups) ? input.backups : [];
    const migrationLog = Array.isArray(input.migrationLog) ? input.migrationLog : [];
    return {
        schemaVersion: 1,
        backups: backups
            .filter(backup => backup && typeof backup === 'object' && backup.state && typeof backup.state === 'object')
            .map(backup => ({
                id: String(backup.id || '').trim(),
                reason: String(backup.reason || 'manual').trim().slice(0, 80) || 'manual',
                label: String(backup.label || '').trim().slice(0, 120),
                createdAt: Number.isFinite(Number(backup.createdAt)) ? Number(backup.createdAt) : 0,
                schemaVersion: Number.isFinite(Number(backup.schemaVersion)) ? Number(backup.schemaVersion) : 0,
                byteLength: Number.isFinite(Number(backup.byteLength)) ? Number(backup.byteLength) : 0,
                state: backup.state,
            }))
            .filter(backup => backup.id && backup.createdAt)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, STATE_SAFETY_BACKUP_LIMIT),
        migrationLog: migrationLog
            .filter(item => item && typeof item === 'object')
            .map(item => ({
                id: String(item.id || '').trim(),
                type: String(item.type || 'migration').trim().slice(0, 80) || 'migration',
                message: String(item.message || '').trim().slice(0, 240),
                createdAt: Number.isFinite(Number(item.createdAt)) ? Number(item.createdAt) : 0,
                fromVersion: Number.isFinite(Number(item.fromVersion)) ? Number(item.fromVersion) : 0,
                toVersion: Number.isFinite(Number(item.toVersion)) ? Number(item.toVersion) : 0,
            }))
            .filter(item => item.id && item.createdAt)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, STATE_SAFETY_MIGRATION_LOG_LIMIT),
        lastBackupAt: Number.isFinite(Number(input.lastBackupAt)) ? Number(input.lastBackupAt) : 0,
        lastBackupReason: String(input.lastBackupReason || '').trim().slice(0, 80),
        lastRestoreAt: Number.isFinite(Number(input.lastRestoreAt)) ? Number(input.lastRestoreAt) : 0,
        lastRestoreSource: String(input.lastRestoreSource || '').trim().slice(0, 120),
    };
}

function stateSafetyId(prefix = 'saga') {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function createStateBackupSnapshot(state = {}) {
    const snapshot = cloneJsonForStateSafety(stripRetiredStateHistoryFields({ ...(state || {}) }), {});
    snapshot.stateSafety = {
        ...normalizeStateSafety(snapshot.stateSafety),
        backups: [],
    };
    return snapshot;
}

export function appendStateSafetyLog(state = {}, entry = {}) {
    if (!state || typeof state !== 'object') return null;
    const safety = normalizeStateSafety(state.stateSafety);
    const now = Date.now();
    const record = {
        id: String(entry.id || stateSafetyId('log')),
        type: String(entry.type || 'migration').trim().slice(0, 80) || 'migration',
        message: String(entry.message || '').trim().slice(0, 240),
        createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : now,
        fromVersion: Number.isFinite(Number(entry.fromVersion)) ? Number(entry.fromVersion) : 0,
        toVersion: Number.isFinite(Number(entry.toVersion)) ? Number(entry.toVersion) : 0,
    };
    safety.migrationLog = [record, ...safety.migrationLog]
        .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
        .slice(0, STATE_SAFETY_MIGRATION_LOG_LIMIT);
    state.stateSafety = safety;
    return record;
}

export function appendStateBackupRecord(state = {}, reason = 'manual', options = {}) {
    if (!state || typeof state !== 'object') return null;
    const safety = normalizeStateSafety(state.stateSafety);
    const now = Number.isFinite(Number(options.createdAt)) ? Number(options.createdAt) : Date.now();
    const snapshot = createStateBackupSnapshot(options.snapshotState || state);
    const backup = {
        id: String(options.id || stateSafetyId('backup')),
        reason: String(reason || 'manual').trim().slice(0, 80) || 'manual',
        label: String(options.label || '').trim().slice(0, 120),
        createdAt: now,
        schemaVersion: Number.isFinite(Number(snapshot._version)) ? Number(snapshot._version) : 0,
        byteLength: safeJsonSize(snapshot),
        state: snapshot,
    };
    safety.backups = [backup, ...safety.backups]
        .filter((item, index, list) => list.findIndex(other => other.id === item.id) === index)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, STATE_SAFETY_BACKUP_LIMIT);
    safety.lastBackupAt = now;
    safety.lastBackupReason = backup.reason;
    state.stateSafety = safety;
    return backup;
}
