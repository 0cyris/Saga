/** Back up supported inline registries before durable externalization. */
import { getSettings, saveSettings } from '../state/settings-store.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaStorageIndexStore } from './saga-storage-index.js';
import { queueSagaStorageMutation, assertSagaStorageWriteAcknowledged, writeSagaStorageJsonFile } from './saga-storage-coordinator.js';
import { verifySagaStorageFiles } from './saga-storage-transactions.js';
import { upsertExternalLorepackPayloadSync } from './saga-lorepack-payload-storage.js';
import { hydrateSagaLorepackLibraryStorage, updateExternalLoredeckLibraryLayoutSync } from './saga-lorepack-library-storage.js';
import { hydrateSagaCreatorProjectStorage, upsertExternalLoredeckCreatorProjectSync } from './saga-creator-project-storage.js';
import { importExternalThemePack, importExternalIconSet } from './saga-theme-icon-storage.js';
import { buildSagaDomainPayloadPath } from './saga-domain-storage.js';
import { SAGA_STORAGE_DOMAIN_INDEX_FILES } from './saga-storage-index.js';

export const SAGA_INLINE_SETTINGS_BACKUP_PATH = '/user/files/saga-inline-settings-backup.v1.json';
const keys = ['loredeckLibrary', 'loredeckCreatorProjects', 'themePackLibrary', 'themeIconSetLibrary'];
const clone = value => JSON.parse(JSON.stringify(value ?? null));
const migrations = new Map();
const stable = value => JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(field => [field, item[field]])) : item;
});
const missing = error => error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error));

async function migrationCollisionCheck(api, entry) {
    let actual;
    try { actual = await api.readJsonFile(entry.path); }
    catch (error) { if (missing(error)) return false; throw error; }
    const backup = await api.readJsonFile(SAGA_INLINE_SETTINGS_BACKUP_PATH);
    const receipt = backup.receipts?.[entry.path];
    if (receipt && stable(receipt.source) === stable(entry.source) && stable(receipt.contents) === stable(actual)) {
        const index = await api.readJsonFile(entry.indexPath);
        const record = index[entry.collection]?.[entry.id];
        if (record && (record.payloadFile || record.projectFile) === entry.path) return true;
    }
    const error = new Error(`Inline ${entry.domain} item '${entry.id}' conflicts with existing external storage. Both copies were retained; export the inline backup and choose which copy to keep.`);
    error.code = 'inline_storage_conflict'; error.conflict = { domain: entry.domain, ownerId: entry.id, path: entry.path };
    throw error;
}

async function saveMigrationReceipt(api, entry) {
    await queueSagaStorageMutation(api, SAGA_INLINE_SETTINGS_BACKUP_PATH, async () => {
        const backup = await api.readJsonFile(SAGA_INLINE_SETTINGS_BACKUP_PATH);
        const contents = await api.readJsonFile(entry.path);
        const next = { ...backup, revision: backup.revision + 1, receipts: { ...backup.receipts, [entry.path]: { source: clone(entry.source), contents } } };
        await writeSagaStorageJsonFile(api, 'saga-inline-settings-backup.v1.json', next, { expectedRevision: backup.revision, domain: 'recovery', path: SAGA_INLINE_SETTINGS_BACKUP_PATH });
    });
}
const hasContent = source => keys.some(key => {
    const registry = source?.[key] || {};
    return Object.keys(registry.packs || registry.jobs || registry.iconSets || {}).length > 0
        || ['folders', 'deckPlacements', 'activeStack'].some(field => registry[field]?.length > 0);
});

async function backupRegistries(api, registries) {
    return queueSagaStorageMutation(api, SAGA_INLINE_SETTINGS_BACKUP_PATH, async () => {
        let backup = { schemaVersion: 1, revision: 1, snapshots: [] };
        let exists = false;
        try { backup = await api.readJsonFile(SAGA_INLINE_SETTINGS_BACKUP_PATH); exists = true; }
        catch (error) { if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error; }
        if (backup.schemaVersion !== 1 || !Array.isArray(backup.snapshots)) throw new Error('Inline settings backup is invalid. Preserve it before retrying migration.');
        if (!backup.snapshots.some(snapshot => JSON.stringify(snapshot.registries) === JSON.stringify(registries))) {
            const next = { ...backup, revision: backup.revision + 1, snapshots: [...backup.snapshots, { createdAt: Date.now(), registries: clone(registries) }] };
            await writeSagaStorageJsonFile(api, 'saga-inline-settings-backup.v1.json', next, {
                expectedRevision: backup.revision, expectedMissing: !exists, domain: 'recovery', path: SAGA_INLINE_SETTINGS_BACKUP_PATH,
            });
        }
        await verifySagaStorageFiles(api, [SAGA_INLINE_SETTINGS_BACKUP_PATH]);
        await createSagaStorageIndexStore({ fileApi: api }).registerFile(SAGA_INLINE_SETTINGS_BACKUP_PATH, { kind: 'settings_inline_backup', ownerId: 'inline-settings', domain: 'recovery', deletion: 'managed' });
    });
}

async function requirePersisted(completion) {
    const result = assertSagaStorageWriteAcknowledged(await completion);
    if (result?.persisted !== true) throw new Error(result?.error || 'Inline storage migration was not durably acknowledged.');
    return result;
}

async function migrate(api, options) {
    const ctx = globalThis.SillyTavern?.getContext?.();
    const raw = clone(ctx?.extensionSettings?.saga || {});
    if (!hasContent(raw)) return { ok: true, persisted: true, migrated: false };
    const registries = Object.fromEntries(keys.map(key => [key, raw[key] || {}]));
    let backupFile = '';
    try {
        for (const [key, registry] of Object.entries(raw.sagaInlineRecovery?.registries || registries)) {
            if (registry.schemaVersion !== undefined && Number(registry.schemaVersion) !== 1) throw new Error(`Unsupported inline storage schema in ${key}. Export the retained registry before migration.`);
        }
        if (typeof ctx.saveSettingsDebounced !== 'function') throw new Error('Settings persistence is unavailable; inline registries were retained.');
        await backupRegistries(api, raw.sagaInlineRecovery?.registries || registries);
        if (raw.sagaInlineRecovery?.registries) await backupRegistries(api, registries);
        backupFile = SAGA_INLINE_SETTINGS_BACKUP_PATH;
        const settings = getSettings();
        const capturedInline = Object.fromEntries(keys.map(key => [key, clone(ctx.extensionSettings.saga[key])]));
        const storage = { ...options, fileApi: api, staleCheck: false, expectedMissing: true };
        await hydrateSagaLorepackLibraryStorage(storage);
        await hydrateSagaCreatorProjectStorage(storage);
        const source = raw.sagaInlineRecovery?.registries || registries;
        const entries = [];
        for (const [key, domain, collection, idKey, write] of [
            ['loredeckLibrary', 'library', 'packs', 'packId', record => upsertExternalLorepackPayloadSync(record, { ...storage, persistOwningIndex: true }).completion],
            ['loredeckCreatorProjects', 'creator', 'jobs', 'jobId', record => upsertExternalLoredeckCreatorProjectSync(record, { ...storage, activeJobId: settings.loredeckCreatorProjects.activeJobId, lastJobId: settings.loredeckCreatorProjects.lastJobId }).completion],
            ['themePackLibrary', 'themes', 'packs', 'id', record => importExternalThemePack(record, storage)],
            ['themeIconSetLibrary', 'iconSets', 'iconSets', 'id', record => importExternalIconSet(record, storage)],
        ]) {
            for (const [id, record] of Object.entries(settings[key]?.[collection] || {})) entries.push({
                domain, collection: domain === 'creator' ? 'projects' : collection, id: record[idKey] || id, record,
                source: source[key]?.[collection]?.[id] || registries[key]?.[collection]?.[id] || record,
                path: record.payloadFile || record.projectFile || buildSagaDomainPayloadPath(domain, record[idKey] || id),
                indexPath: SAGA_STORAGE_DOMAIN_INDEX_FILES[domain], write,
            });
        }
        for (const entry of entries) entry.completed = await migrationCollisionCheck(api, entry);
        const layout = Object.fromEntries(['folders', 'deckPlacements', 'activeStack'].map(key => [key, clone(settings.loredeckLibrary?.[key] || [])]));
        let existingLayout = { folders: [], deckPlacements: [], activeStack: [] };
        try {
            const durable = await api.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.library);
            existingLayout = Object.fromEntries(Object.keys(layout).map(key => [key, durable[key] || []]));
        } catch (error) { if (!missing(error)) throw error; }
        if (Object.values(layout).some(items => items.length) && Object.values(existingLayout).some(items => items.length) && stable(layout) !== stable(existingLayout)) {
            const error = new Error('Inline Library layout conflicts with existing external organization. Both copies were retained; export the inline backup before choosing the layout to keep.');
            error.code = 'inline_storage_conflict'; error.conflict = { domain: 'library', ownerId: 'layout', path: SAGA_STORAGE_DOMAIN_INDEX_FILES.library };
            throw error;
        }
        for (const entry of entries) {
            if (entry.completed) continue;
            await requirePersisted(entry.write(entry.record));
            await saveMigrationReceipt(api, entry);
        }
        await hydrateSagaLorepackLibraryStorage({ ...storage, force: true });
        if (Object.values(layout).some(items => items.length) && stable(layout) !== stable(existingLayout)) await requirePersisted(updateExternalLoredeckLibraryLayoutSync(layout, { ...storage, expectedLayout: existingLayout }).completion);
        if (globalThis.SillyTavern?.getContext?.()?.extensionSettings !== ctx.extensionSettings) throw new Error('Settings owner changed during migration. Inline data was retained.');
        const changed = keys.filter(key => stable(ctx.extensionSettings.saga[key]) !== stable(capturedInline[key]));
        if (changed.length) throw new Error(`Inline settings changed during migration (${changed.join(', ')}). Retry the retained current registries.`);
        const current = getSettings();
        current.loredeckLibrary = { schemaVersion: 1, packs: {}, folders: [], deckPlacements: [], activeStack: [] };
        current.loredeckCreatorProjects = { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} };
        current.themePackLibrary = { schemaVersion: 1, packs: {} };
        current.themeIconSetLibrary = { schemaVersion: 1, iconSets: {} };
        current.sagaInlineRecovery = { schemaVersion: 1, status: 'migrated', backupFile, migratedAt: Date.now() };
        let settingsReceipt;
        try { settingsReceipt = assertSagaStorageWriteAcknowledged(await saveSettings(current)); }
        catch (error) { ctx.extensionSettings.saga = raw; throw error; }
        return { ok: true, persisted: true, externalPersisted: true, settingsPersisted: settingsReceipt?.persisted === true, migrated: true, backupFile };
    } catch (error) {
        return { ok: false, persisted: false, code: error.code, conflict: error.conflict, error: String(error?.message || error), backupFile, retainedInline: true };
    }
}

export async function migrateSagaInlineStorage(options = {}) {
    const api = options.fileApi || createSagaFileApi(options.fileApiOptions || {});
    const identity = api.storageBackendIdentity || api;
    if (migrations.has(identity)) return migrations.get(identity);
    const pending = migrate(api, options);
    migrations.set(identity, pending);
    try { return await pending; } finally { if (migrations.get(identity) === pending) migrations.delete(identity); }
}
