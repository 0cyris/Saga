import assert from 'node:assert/strict';
import { createSagaFileApi, __sagaFileApiTestHooks } from '../../src/storage/saga-file-api.js';
import { migrateSagaInlineStorage } from '../../src/storage/saga-inline-settings-migration.js';
import { getSettings } from '../../src/state/settings-store.js';
import * as payload from '../../src/storage/saga-lorepack-payload-storage.js';
import * as library from '../../src/storage/saga-lorepack-library-storage.js';
import * as creator from '../../src/storage/saga-creator-project-storage.js';

const files = new Map();
let reject = () => false;
const fileApi = createSagaFileApi({ storageBackendIdentity: {}, fetchImpl: async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    const respond = (ok, status, value) => ({ ok, status, async text() { return value; } });
    if (url === '/api/files/upload') {
        if (reject(body.name)) return respond(false, 500, 'migration refused');
        const path = `/user/files/${body.name}`;
        files.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
        return respond(true, 200, JSON.stringify({ path }));
    }
    if (url === '/api/files/delete') { files.delete(body.path); return respond(true, 200, '{}'); }
    if (url === '/api/files/verify') return respond(true, 200, JSON.stringify(Object.fromEntries(body.urls.map(path => [path, files.has(path)]))));
    return respond(files.has(url), files.has(url) ? 200 : 404, files.get(url) || 'missing');
} });
const original = {
    enabled: true, experienceMode: 'advanced',
    loredeckLibrary: { schemaVersion: 1, packs: { inline: { packId: 'inline', title: 'Inline Pack', type: 'custom', entryOverrides: { one: { id: 'one', content: { fact: 'Keep the lore' } } } } } },
    loredeckCreatorProjects: { schemaVersion: 1, activeJobId: 'inline_creator', jobs: { inline_creator: { jobId: 'inline_creator', projectTitle: 'Inline Creator', titleDrafts: [{ titleId: 'one', title: 'Keep the draft' }] } } },
    themePackLibrary: { schemaVersion: 1, packs: { inline_theme: { id: 'inline_theme', title: 'Inline Theme', colors: { accent: '#123456' } } } },
    themeIconSetLibrary: { schemaVersion: 1, iconSets: { inline_icons: { id: 'inline_icons', title: 'Inline Icons', icons: { 'tab.loredecks': 'data:image/png;base64,aWNvbg==' } } } },
};
const extensionSettings = { saga: structuredClone(original) };
globalThis.SillyTavern = { getContext: () => ({ extensionSettings, chatMetadata: {}, saveSettingsDebounced() {} }) };
payload.resetSagaLorepackPayloadStorageCache(); library.resetSagaLorepackLibraryStorageCache(); creator.resetSagaCreatorProjectStorageCache();
const options = { fileApi, staleCheck: false, onWriteError() {} };
payload.configureSagaLorepackPayloadStorage(options); library.configureSagaLorepackLibraryStorage(options); creator.configureSagaCreatorProjectStorage(options);

getSettings();
reject = name => name === 'saga-library-index.v1.json';
const refused = await migrateSagaInlineStorage(options);
assert.equal(refused.ok, false);
assert(extensionSettings.saga.loredeckLibrary.packs.inline, 'Failed migration must retain the inline source.');
assert(extensionSettings.saga.loredeckCreatorProjects.jobs.inline_creator);
assert(files.has(refused.backupFile), 'A migration backup must precede all external writes.');

reject = () => false;
const migrated = await migrateSagaInlineStorage(options);
assert.equal(migrated.ok, true);
assert.equal(migrated.persisted, true);
assert.deepEqual(extensionSettings.saga.loredeckLibrary.packs, {});
assert.deepEqual(extensionSettings.saga.loredeckCreatorProjects.jobs, {});
assert.deepEqual(extensionSettings.saga.themePackLibrary.packs, {});
assert.deepEqual(extensionSettings.saga.themeIconSetLibrary.iconSets, {});
assert.equal(JSON.parse(files.get('/user/files/saga-pack-inline.v1.json')).entryOverrides.one.content.fact, 'Keep the lore');
assert.equal(JSON.parse(files.get('/user/files/saga-creator-project-inline_creator.v1.json')).titleDrafts[0].title, 'Keep the draft');
const backup = JSON.parse(files.get(migrated.backupFile));
assert.equal(backup.snapshots[0].registries.loredeckLibrary.packs.inline.entryOverrides.one.content.fact, 'Keep the lore');
assert(files.has('/user/files/saga-theme-pack-inline_theme.v1.json'));
assert(files.has('/user/files/saga-iconset-inline_icons.v1.json'));

const existingFiles = new Map(files);
for (const [key, path, patch] of [
    ['loredeckLibrary', '/user/files/saga-pack-inline.v1.json', { title: 'Newer canonical pack' }],
    ['loredeckCreatorProjects', '/user/files/saga-creator-project-inline_creator.v1.json', { projectTitle: 'Newer canonical project' }],
    ['themePackLibrary', '/user/files/saga-theme-pack-inline_theme.v1.json', { title: 'Newer canonical theme' }],
    ['themeIconSetLibrary', '/user/files/saga-iconset-inline_icons.v1.json', { title: 'Newer canonical icons' }],
]) {
    files.clear(); for (const [file, contents] of existingFiles) files.set(file, contents);
    extensionSettings.saga = { ...structuredClone(original), loredeckLibrary: { schemaVersion: 1, packs: {} }, loredeckCreatorProjects: { schemaVersion: 1, jobs: {} }, themePackLibrary: { schemaVersion: 1, packs: {} }, themeIconSetLibrary: { schemaVersion: 1, iconSets: {} }, [key]: structuredClone(original[key]) };
    const newer = JSON.stringify({ ...JSON.parse(files.get(path)), ...patch }); files.set(path, newer);
    const conflict = await migrateSagaInlineStorage(options);
    assert.equal(conflict.ok, false, `${key}: divergent canonical content must refuse migration.`);
    assert.equal(conflict.code, 'inline_storage_conflict');
    assert.equal(files.get(path), newer);
    const collection = key === 'loredeckCreatorProjects' ? 'jobs' : key === 'themeIconSetLibrary' ? 'iconSets' : 'packs';
    assert.equal(Object.keys(extensionSettings.saga[key][collection]).length, 1, 'Conflicting inline owner remains available.');
}
files.clear(); for (const [file, contents] of existingFiles) files.set(file, contents);
extensionSettings.saga = structuredClone(original);
const repeated = await migrateSagaInlineStorage(options);
assert.equal(repeated.ok, true, `Equivalent completed migration must be idempotent after settings persistence lags: ${repeated.error}`);
assert.equal(repeated.externalPersisted, true);
assert.equal(repeated.settingsPersisted, false, 'A void host settings scheduler cannot confirm disk persistence.');

extensionSettings.saga = { enabled: true, experienceMode: 'advanced', loredeckLibrary: { schemaVersion: 1, packs: {}, folders: [{ id: 'inline-folder', title: 'Older inline organization' }] } };
const libraryPath = '/user/files/saga-library-index.v1.json';
const externalLibrary = { ...JSON.parse(files.get(libraryPath)), revision: 20, folders: [{ id: 'external-folder', title: 'Newer external organization' }] };
const externalBytes = JSON.stringify(externalLibrary); files.set(libraryPath, externalBytes);
const layoutConflict = await migrateSagaInlineStorage(options);
assert.equal(layoutConflict.ok, false, 'Divergent existing external layout must refuse inline replacement.');
assert.equal(layoutConflict.code, 'inline_storage_conflict');
assert.equal(files.get(libraryPath), externalBytes);
assert.equal(extensionSettings.saga.loredeckLibrary.folders[0].id, 'inline-folder');

files.clear(); for (const [file, contents] of existingFiles) files.set(file, contents);
extensionSettings.saga = structuredClone(original);
globalThis.SillyTavern = { getContext: () => ({ extensionSettings, chatMetadata: {}, saveSettingsDebounced: () => ({ ok: false, error: 'Settings trim refused' }) }) };
const refusedTrim = await migrateSagaInlineStorage(options);
assert.equal(refusedTrim.ok, false);
assert.match(refusedTrim.error, /Settings trim refused/);
assert.deepEqual(extensionSettings.saga, original, 'A refused settings trim restores the exact original inline source.');
assert(files.has(refusedTrim.backupFile));

extensionSettings.saga = structuredClone(original);
extensionSettings.saga.loredeckLibrary.schemaVersion = 99;
const unsupported = await migrateSagaInlineStorage(options);
assert.equal(unsupported.ok, false);
assert.match(unsupported.error, /unsupported.*schema/i);
assert(extensionSettings.saga.loredeckLibrary.packs.inline);
console.log('Saga inline settings migration tests passed.');
