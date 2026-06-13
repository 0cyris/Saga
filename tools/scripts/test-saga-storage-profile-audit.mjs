import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
  SAGA_STORAGE_VERSION,
} from '../../src/storage/saga-storage-index.js';
import {
  getSagaUserFilesFileName,
} from '../../src/storage/saga-storage-filenames.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AUDIT_SCRIPT = path.join(ROOT, 'tools', 'scripts', 'audit-saga-storage-profile.mjs');
const PACK_PATH = '/user/files/saga-pack-audit-pack.v1.json';
const ORPHAN_PATH = '/user/files/saga-pack-orphan.v1.json';
const INVALID_FILE_PATH = '/user/files/saga-pack-invalid.exe';

function toProfileStoragePath(profileDir, storagePath) {
  return path.join(profileDir, 'user', 'files', getSagaUserFilesFileName(storagePath));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeRaw(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf8');
}

async function makeProfile({ unsupportedSettingsPayloads = false } = {}) {
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saga-storage-audit-'));
  const now = 1781369000000;
  await writeJson(path.join(profileDir, 'settings.json'), {
    extension_settings: {
      saga: {
        sagaStorage: {
          enabled: true,
          masterIndexFile: SAGA_STORAGE_INDEX_PATH,
          libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
          creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
          themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
          iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
          storageVersion: SAGA_STORAGE_VERSION,
        },
        sagaStorageFallback: {
          libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
          creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
          themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
          iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        },
        loredeckLibrary: unsupportedSettingsPayloads
          ? {
              schemaVersion: 1,
              packs: {
                'settings-backed-audit-pack': {
                  packId: 'settings-backed-audit-pack',
                  type: 'generated',
                  title: 'Unsupported Settings-Backed Audit Pack',
                },
              },
              folders: [],
              deckPlacements: [],
              activeStack: [],
            }
          : { schemaVersion: 1, packs: {}, folders: [], deckPlacements: [], activeStack: [] },
        loredeckCreatorProjects: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
        themePackLibrary: { schemaVersion: 1, packs: {} },
        themeIconSetLibrary: { schemaVersion: 1, iconSets: {} },
      },
    },
  });
  await writeJson(toProfileStoragePath(profileDir, SAGA_STORAGE_INDEX_PATH), {
    schemaVersion: 1,
    kind: 'saga_storage_index',
    updatedAt: now,
    revision: 3,
    domains: {
      library: { indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library, updatedAt: now },
      creator: { indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, updatedAt: now },
      themes: { indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes, updatedAt: now },
      iconSets: { indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets, updatedAt: now },
    },
    files: {
      [SAGA_STORAGE_INDEX_PATH]: { kind: 'storage_index', domain: 'storage', ownerId: 'storage', mime: 'application/json', deletion: 'managed' },
      [SAGA_STORAGE_DOMAIN_INDEX_FILES.library]: { kind: 'library_index', domain: 'library', ownerId: 'library', mime: 'application/json', deletion: 'managed' },
      [PACK_PATH]: { kind: 'lorepack_payload', domain: 'library', ownerId: 'audit-pack', mime: 'application/json', deletion: 'delete_with_owner' },
    },
  });
  await writeJson(toProfileStoragePath(profileDir, SAGA_STORAGE_DOMAIN_INDEX_FILES.library), {
    schemaVersion: 1,
    kind: 'saga_library_index',
    updatedAt: now,
    revision: 1,
    packs: {
      'audit-pack': {
        packId: 'audit-pack',
        type: 'generated',
        title: 'Audit Pack',
        payloadFile: PACK_PATH,
      },
    },
    folders: [],
    deckPlacements: [],
    activeStack: [],
  });
  await writeJson(toProfileStoragePath(profileDir, PACK_PATH), {
    schemaVersion: 1,
    kind: 'saga_lorepack_payload',
    revision: 1,
    updatedAt: now,
    packId: 'audit-pack',
    type: 'generated',
    title: 'Audit Pack',
  });
  return profileDir;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function mutateSettings(profileDir, mutate) {
  const settingsPath = path.join(profileDir, 'settings.json');
  const settings = await readJson(settingsPath);
  mutate(settings);
  await writeJson(settingsPath, settings);
}

async function removeStorageFile(profileDir, storagePath) {
  await fs.rm(toProfileStoragePath(profileDir, storagePath), { force: true });
}

async function mutateMasterIndex(profileDir, mutate) {
  const indexPath = toProfileStoragePath(profileDir, SAGA_STORAGE_INDEX_PATH);
  const index = await readJson(indexPath);
  mutate(index);
  await writeJson(indexPath, index);
}

async function mutateStorageJson(profileDir, storagePath, mutate) {
  const filePath = toProfileStoragePath(profileDir, storagePath);
  const value = await readJson(filePath);
  mutate(value);
  await writeJson(filePath, value);
}

function runAudit(profilePath, args = []) {
  try {
    const stdout = execFileSync(process.execPath, [AUDIT_SCRIPT, ...args, '--profile', profilePath], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, json: JSON.parse(stdout) };
  } catch (error) {
    return {
      status: error.status || 1,
      json: JSON.parse(error.stdout.toString('utf8')),
    };
  }
}

function runAuditCli(args = []) {
  try {
    const stdout = execFileSync(process.execPath, [AUDIT_SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: error.stdout?.toString('utf8') || '',
      stderr: error.stderr?.toString('utf8') || '',
    };
  }
}

const helpOutput = execFileSync(process.execPath, [AUDIT_SCRIPT, '--help'], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert(helpOutput.includes('Usage: node tools/scripts/audit-saga-storage-profile.mjs --profile'));
assert(helpOutput.includes('--text'));

const missingProfileValue = runAuditCli(['--profile', '--text']);
assert.notEqual(missingProfileValue.status, 0);
assert(missingProfileValue.stderr.includes('Missing value for --profile'));

const unknownOption = runAuditCli(['--unknown']);
assert.notEqual(unknownOption.status, 0);
assert(unknownOption.stderr.includes('Unknown option: --unknown'));

const unsupportedSettingsProfile = await makeProfile({ unsupportedSettingsPayloads: true });
const unsupportedSettingsResult = runAudit(unsupportedSettingsProfile);
assert.notEqual(unsupportedSettingsResult.status, 0);
assert.equal(unsupportedSettingsResult.json.ok, false);
assert(unsupportedSettingsResult.json.errors.some(error => error.code === 'unsupported_settings_backed_library'));

const compactProfile = await makeProfile();
const compactResult = runAudit(compactProfile);
assert.equal(compactResult.status, 0);
assert.equal(compactResult.json.ok, true);
assert.equal(compactResult.json.errors.length, 0);
assert.equal(compactResult.json.files.orphanFiles.length, 0);
assert.equal(compactResult.json.files.missingTrackedFiles.length, 0);

const settingsPathProfile = runAudit(path.join(compactProfile, 'settings.json'));
assert.equal(settingsPathProfile.status, 0, 'settings.json path should resolve to the containing profile.');

const filesDirProfile = runAudit(path.join(compactProfile, 'user', 'files'));
assert.equal(filesDirProfile.status, 0, 'user/files path should resolve to the containing profile.');

const extraArgument = runAuditCli(['--profile', compactProfile, 'extra']);
assert.notEqual(extraArgument.status, 0);
assert(extraArgument.stderr.includes('Unexpected argument: extra'));

const textResult = execFileSync(process.execPath, [AUDIT_SCRIPT, '--text', '--profile', compactProfile], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert(textResult.includes('Saga storage profile audit: PASS'));

const heavyProfile = await makeProfile();
await mutateSettings(heavyProfile, settings => {
  settings.extension_settings.saga.loredeckLibrary.packs['bad-heavy-pack'] = {
    packId: 'bad-heavy-pack',
    type: 'generated',
    entries: [{ id: 'entry-1', text: 'This should not live in settings.' }],
  };
});
const heavyResult = runAudit(heavyProfile);
assert.notEqual(heavyResult.status, 0);
assert(heavyResult.json.errors.some(error => error.code === 'unsupported_settings_backed_library'));
assert(heavyResult.json.errors.some(error => error.code === 'heavy_payload_in_settings'));

const missingFileProfile = await makeProfile();
await removeStorageFile(missingFileProfile, PACK_PATH);
const missingFileResult = runAudit(missingFileProfile);
assert.notEqual(missingFileResult.status, 0);
assert(missingFileResult.json.errors.some(error => error.code === 'missing_tracked_file'));
assert(missingFileResult.json.errors.some(error => error.code === 'missing_storage_file'));

const invalidMasterPathProfile = await makeProfile();
await mutateMasterIndex(invalidMasterPathProfile, index => {
  index.files['/img/saga-outside.v1.json'] = { kind: 'lorepack_payload', domain: 'library', ownerId: 'outside' };
});
const invalidMasterPathResult = runAudit(invalidMasterPathProfile);
assert.notEqual(invalidMasterPathResult.status, 0);
assert(invalidMasterPathResult.json.errors.some(error => error.code === 'invalid_master_index_record_path' && error.detail?.path === '/img/saga-outside.v1.json'));

const invalidMasterFilenameProfile = await makeProfile();
await mutateMasterIndex(invalidMasterFilenameProfile, index => {
  index.files[INVALID_FILE_PATH] = { kind: 'lorepack_payload', domain: 'library', ownerId: 'invalid' };
});
const invalidMasterFilenameResult = runAudit(invalidMasterFilenameProfile);
assert.notEqual(invalidMasterFilenameResult.status, 0);
assert(invalidMasterFilenameResult.json.errors.some(error => error.code === 'invalid_master_index_record_path' && error.detail?.path === INVALID_FILE_PATH));

const invalidMasterPayloadMetadataProfile = await makeProfile();
await mutateMasterIndex(invalidMasterPayloadMetadataProfile, index => {
  index.files[PACK_PATH] = { kind: 'creator_project_payload', domain: 'creator', ownerId: 'audit-pack' };
});
const invalidMasterPayloadMetadataResult = runAudit(invalidMasterPayloadMetadataProfile);
assert.notEqual(invalidMasterPayloadMetadataResult.status, 0);
assert(invalidMasterPayloadMetadataResult.json.errors.some(error => error.code === 'invalid_master_index_record_metadata'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected?.kind === 'lorepack_payload'
  && error.detail?.expected?.domain === 'library'
  && error.detail?.actual?.kind === 'creator_project_payload'
  && error.detail?.actual?.domain === 'creator'));

const invalidMasterIndexMetadataProfile = await makeProfile();
await mutateMasterIndex(invalidMasterIndexMetadataProfile, index => {
  index.files[SAGA_STORAGE_DOMAIN_INDEX_FILES.library] = { kind: 'creator_index', domain: 'creator', ownerId: 'library' };
});
const invalidMasterIndexMetadataResult = runAudit(invalidMasterIndexMetadataProfile);
assert.notEqual(invalidMasterIndexMetadataResult.status, 0);
assert(invalidMasterIndexMetadataResult.json.errors.some(error => error.code === 'invalid_master_index_record_metadata'
  && error.detail?.path === SAGA_STORAGE_DOMAIN_INDEX_FILES.library
  && error.detail?.expected?.kind === 'library_index'
  && error.detail?.expected?.domain === 'library'
  && error.detail?.actual?.kind === 'creator_index'
  && error.detail?.actual?.domain === 'creator'));

const invalidMasterOwnerProfile = await makeProfile();
await mutateMasterIndex(invalidMasterOwnerProfile, index => {
  index.files[PACK_PATH] = { ...index.files[PACK_PATH], ownerId: 'wrong-pack' };
});
const invalidMasterOwnerResult = runAudit(invalidMasterOwnerProfile);
assert.notEqual(invalidMasterOwnerResult.status, 0);
assert(invalidMasterOwnerResult.json.errors.some(error => error.code === 'invalid_master_index_record_owner'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected === 'audit-pack'
  && error.detail?.actual === 'wrong-pack'));

const invalidMasterLifecycleProfile = await makeProfile();
await mutateMasterIndex(invalidMasterLifecycleProfile, index => {
  index.files[PACK_PATH] = { ...index.files[PACK_PATH], mime: 'text/plain', deletion: 'managed' };
});
const invalidMasterLifecycleResult = runAudit(invalidMasterLifecycleProfile);
assert.notEqual(invalidMasterLifecycleResult.status, 0);
assert(invalidMasterLifecycleResult.json.errors.some(error => error.code === 'invalid_master_index_record_mime'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected === 'application/json'
  && error.detail?.actual === 'text/plain'));
assert(invalidMasterLifecycleResult.json.errors.some(error => error.code === 'invalid_master_index_record_deletion'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected === 'delete_with_owner'
  && error.detail?.actual === 'managed'));

const invalidMasterDomainProfile = await makeProfile();
await mutateMasterIndex(invalidMasterDomainProfile, index => {
  index.domains.library.indexFile = SAGA_STORAGE_DOMAIN_INDEX_FILES.creator;
  index.domains.creator.updatedAt = 0;
});
const invalidMasterDomainResult = runAudit(invalidMasterDomainProfile);
assert.notEqual(invalidMasterDomainResult.status, 0);
assert(invalidMasterDomainResult.json.errors.some(error => error.code === 'invalid_master_domain_index_file'
  && error.detail?.domain === 'library'
  && error.detail?.expected === SAGA_STORAGE_DOMAIN_INDEX_FILES.library
  && error.detail?.actual === SAGA_STORAGE_DOMAIN_INDEX_FILES.creator));
assert(invalidMasterDomainResult.json.errors.some(error => error.code === 'invalid_master_domain_updated_at'
  && error.detail?.domain === 'creator'
  && error.detail?.actual === 0));

const invalidDomainKindProfile = await makeProfile();
await mutateStorageJson(invalidDomainKindProfile, SAGA_STORAGE_DOMAIN_INDEX_FILES.library, index => {
  index.kind = 'saga_creator_index';
});
const invalidDomainKindResult = runAudit(invalidDomainKindProfile);
assert.notEqual(invalidDomainKindResult.status, 0);
assert(invalidDomainKindResult.json.errors.some(error => error.code === 'invalid_domain_index_kind'
  && error.detail?.path === SAGA_STORAGE_DOMAIN_INDEX_FILES.library
  && error.detail?.expected === 'saga_library_index'
  && error.detail?.actual === 'saga_creator_index'));

const invalidPayloadKindProfile = await makeProfile();
await mutateStorageJson(invalidPayloadKindProfile, PACK_PATH, payload => {
  payload.kind = 'saga_creator_project';
});
const invalidPayloadKindResult = runAudit(invalidPayloadKindProfile);
assert.notEqual(invalidPayloadKindResult.status, 0);
assert(invalidPayloadKindResult.json.errors.some(error => error.code === 'invalid_storage_json_kind'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected === 'saga_lorepack_payload'
  && error.detail?.actual === 'saga_creator_project'));

const invalidPayloadIdProfile = await makeProfile();
await mutateStorageJson(invalidPayloadIdProfile, PACK_PATH, payload => {
  payload.packId = 'wrong-pack';
  payload.id = 'wrong-pack';
});
const invalidPayloadIdResult = runAudit(invalidPayloadIdProfile);
assert.notEqual(invalidPayloadIdResult.status, 0);
assert(invalidPayloadIdResult.json.errors.some(error => error.code === 'invalid_storage_json_id'
  && error.detail?.path === PACK_PATH
  && error.detail?.expected === 'audit-pack'
  && error.detail?.actual === 'wrong-pack'));

const invalidPayloadEnvelopeProfile = await makeProfile();
await mutateStorageJson(invalidPayloadEnvelopeProfile, PACK_PATH, payload => {
  payload.schemaVersion = 0;
  delete payload.revision;
  payload.updatedAt = 0;
});
const invalidPayloadEnvelopeResult = runAudit(invalidPayloadEnvelopeProfile);
assert.notEqual(invalidPayloadEnvelopeResult.status, 0);
assert(invalidPayloadEnvelopeResult.json.errors.some(error => error.code === 'invalid_storage_json_schema_version'
  && error.detail?.path === PACK_PATH));
assert(invalidPayloadEnvelopeResult.json.errors.some(error => error.code === 'invalid_storage_json_revision'
  && error.detail?.path === PACK_PATH));
assert(invalidPayloadEnvelopeResult.json.errors.some(error => error.code === 'invalid_storage_json_updated_at'
  && error.detail?.path === PACK_PATH));

const orphanFileProfile = await makeProfile();
await writeJson(toProfileStoragePath(orphanFileProfile, ORPHAN_PATH), {
  schemaVersion: 1,
  kind: 'saga_lorepack_payload',
  packId: 'orphan-pack',
});
const orphanFileResult = runAudit(orphanFileProfile);
assert.notEqual(orphanFileResult.status, 0);
assert(orphanFileResult.json.errors.some(error => error.code === 'orphan_saga_file'));

const invalidJsonProfile = await makeProfile();
await writeRaw(toProfileStoragePath(invalidJsonProfile, PACK_PATH), '{ "kind": "saga_lorepack_payload", ');
const invalidJsonResult = runAudit(invalidJsonProfile);
assert.notEqual(invalidJsonResult.status, 0);
assert(invalidJsonResult.json.errors.some(error => error.code === 'invalid_storage_json' && error.detail?.path === PACK_PATH));

const invalidFileProfile = await makeProfile();
await writeRaw(toProfileStoragePath(invalidFileProfile, INVALID_FILE_PATH), 'not a supported Saga storage file');
const invalidFileResult = runAudit(invalidFileProfile);
assert.notEqual(invalidFileResult.status, 0);
assert(invalidFileResult.json.files.invalidFiles.includes(INVALID_FILE_PATH));
assert(invalidFileResult.json.errors.some(error => error.code === 'invalid_saga_file' && error.detail?.path === INVALID_FILE_PATH));

console.log('Saga storage profile audit tests passed.');
