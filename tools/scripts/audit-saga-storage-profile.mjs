#!/usr/bin/env node
/**
 * Read-only audit for a real SillyTavern user profile after Saga external
 * storage workflows have run. This script intentionally does not write or
 * repair anything; it turns the storage signoff checklist into repeatable
 * evidence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
  SAGA_STORAGE_VERSION,
} from '../../src/storage/saga-storage-index.js';
import {
  SAGA_DOMAIN_STORAGE_CONFIGS,
} from '../../src/storage/saga-domain-storage.js';
import {
  SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
  SAGA_STORAGE_JSON_EXTENSION,
  SAGA_STORAGE_VERSION_SEGMENT,
  SAGA_USER_FILES_PREFIX,
  getSagaUserFilesFileName,
  normalizeSagaStorageId,
} from '../../src/storage/saga-storage-filenames.js';

const SAGA_STORAGE_FILE_RE = /^saga-[a-z0-9_.-]+\.(json|png|jpe?g|webp|avif)$/i;
const SAGA_JSON_FILE_RE = /^saga-[a-z0-9_.-]+\.json$/i;
const SAGA_PREFIX_FILE_RE = /^saga-/i;
const HEAVY_SETTINGS_KEYS = Object.freeze([
  'entryFiles',
  'entries',
  'manifestData',
  'tagRegistry',
  'timelineRegistry',
  'pendingChanges',
  'modelDrafts',
  'draftBatches',
  'acceptedDrafts',
  'repairSessions',
]);
const KNOWN_INDEX_PATHS = Object.freeze([
  SAGA_STORAGE_INDEX_PATH,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
]);
const EXPECTED_STORAGE_JSON_KINDS = Object.freeze({
  lorepackPayload: 'saga_lorepack_payload',
  creatorProject: 'saga_creator_project',
  themePack: 'saga_theme_pack',
  iconSet: 'saga_iconset',
  repairSession: 'saga_loredeck_health_repair_session',
});
const JSON_MIME = 'application/json';
const MASTER_INDEX_RECORD_EXPECTATIONS = Object.freeze(new Map([
  [SAGA_STORAGE_INDEX_PATH, Object.freeze({ kind: 'storage_index', domain: 'storage', ownerId: 'storage', mime: JSON_MIME, deletion: 'managed' })],
  ...Object.values(SAGA_DOMAIN_STORAGE_CONFIGS).map(config => [
    config.indexFile,
    Object.freeze({ kind: config.indexRecordKind, domain: config.domain, ownerId: config.domain, mime: JSON_MIME, deletion: 'managed' }),
  ]),
]));

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    profile: process.env.SAGA_ST_USER_DIR || '',
    json: true,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '');
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--profile') {
      const next = String(argv[index + 1] || '');
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for --profile.\n${usageText()}`);
      }
      options.profile = next;
      index += 1;
      continue;
    }
    if (arg === '--text') {
      options.json = false;
      continue;
    }
    if (!arg.startsWith('--') && !options.profile) {
      options.profile = arg;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}\n${usageText()}`);
    }
    throw new Error(`Unknown option: ${arg}\n${usageText()}`);
  }
  return options;
}

function usageText() {
  return [
    'Usage: node tools/scripts/audit-saga-storage-profile.mjs --profile <SillyTavern data/default-user path>',
    '',
    'Read-only Saga storage audit for a SillyTavern user profile.',
    '',
    'Options:',
    '  --profile <path>  Profile directory, settings.json path, or user/files directory.',
    '  --text            Print a compact text summary instead of JSON.',
    '  --help, -h        Show this help text.',
  ].join('\n');
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneSummary(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
}

async function pathExists(filePath = '') {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(filePath = '') {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function statBytes(filePath = '') {
  try {
    return (await fs.stat(filePath)).size;
  } catch {
    return 0;
  }
}

async function resolveProfileDir(input = '') {
  const raw = String(input || '').trim();
  if (!raw) {
    throw new Error('Usage: node tools/scripts/audit-saga-storage-profile.mjs --profile <SillyTavern data/default-user path>');
  }
  const resolved = path.resolve(raw);
  const base = path.basename(resolved).toLowerCase();
  if (base === 'settings.json') return path.dirname(resolved);
  if (base === 'files' && path.basename(path.dirname(resolved)).toLowerCase() === 'user') {
    return path.dirname(path.dirname(resolved));
  }
  return resolved;
}

function toStoragePath(fileName = '') {
  return `${SAGA_USER_FILES_PREFIX}${fileName}`;
}

function toProfileFilePath(profileDir = '', storagePath = '') {
  const fileName = getSagaUserFilesFileName(storagePath);
  return fileName ? path.join(profileDir, 'user', 'files', fileName) : '';
}

async function readStorageJson(profileDir = '', storagePath = '', context = null, label = 'Saga JSON file') {
  const filePath = toProfileFilePath(profileDir, storagePath);
  if (!filePath || !(await pathExists(filePath))) return null;
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    const cleanPath = String(storagePath || '').trim();
    if (context?.errors && cleanPath && !context.invalidJsonPaths?.has(cleanPath)) {
      context.invalidJsonPaths?.add(cleanPath);
      addIssue(context.errors, 'invalid_storage_json', `${label} is not valid JSON.`, {
        path: cleanPath,
        error: String(error?.message || error || ''),
      });
    }
    return null;
  }
}

async function listSagaFiles(profileDir = '') {
  const userFilesDir = path.join(profileDir, 'user', 'files');
  if (!(await pathExists(userFilesDir))) return [];
  const entries = await fs.readdir(userFilesDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !SAGA_PREFIX_FILE_RE.test(entry.name)) continue;
    const filePath = path.join(userFilesDir, entry.name);
    files.push({
      fileName: entry.name,
      path: toStoragePath(entry.name),
      bytes: await statBytes(filePath),
      validStorageFile: SAGA_STORAGE_FILE_RE.test(entry.name),
    });
  }
  return files.sort((left, right) => left.fileName.localeCompare(right.fileName));
}

function countObject(value = {}) {
  return isPlainObject(value) ? Object.keys(value).length : 0;
}

function countByType(records = {}) {
  const counts = {};
  for (const item of Object.values(isPlainObject(records) ? records : {})) {
    const type = String(item?.type || 'unknown').trim() || 'unknown';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function collectHeavySettingHits(value, pointer = 'saga', hits = []) {
  if (!value) return hits;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectHeavySettingHits(item, `${pointer}[${index}]`, hits));
    return hits;
  }
  if (!isPlainObject(value)) return hits;
  for (const [key, child] of Object.entries(value)) {
    if (HEAVY_SETTINGS_KEYS.includes(key)) {
      const bytes = jsonBytes(child);
      const count = Array.isArray(child) ? child.length : countObject(child);
      if (bytes > 16 || count > 0) {
        hits.push({ path: `${pointer}.${key}`, bytes, count });
      }
    }
    collectHeavySettingHits(child, `${pointer}.${key}`, hits);
    if (hits.length >= 80) break;
  }
  return hits;
}

function collectStoragePointers(value, output = new Set()) {
  if (!value) return output;
  if (typeof value === 'string') {
    const text = value.trim();
    if (text.startsWith(SAGA_USER_FILES_PREFIX) && /\/saga-[^/]+$/i.test(text)) output.add(text);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach(item => collectStoragePointers(item, output));
    return output;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach(item => collectStoragePointers(item, output));
  }
  return output;
}

function addIssue(list, code = '', message = '', detail = {}) {
  list.push({
    code,
    message,
    ...(isPlainObject(detail) && Object.keys(detail).length ? { detail: cloneSummary(detail) } : {}),
  });
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function auditDomainIndexKind(context, index = null, domain = '', label = '', storagePath = '') {
  if (!index) return;
  auditStorageJsonEnvelope(context, index, storagePath, label, {
    revisionRequired: true,
    updatedAtRequired: true,
  });
  const expected = SAGA_DOMAIN_STORAGE_CONFIGS[domain]?.indexKind || '';
  if (!expected) return;
  const actual = String(index.kind || '');
  if (actual !== expected) {
    addIssue(context.errors, 'invalid_domain_index_kind', `${label} has an unexpected kind.`, {
      path: storagePath,
      expected,
      actual,
    });
  }
}

function isPositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 1;
}

function auditStorageJsonEnvelope(context, payload = null, storagePath = '', label = '', options = {}) {
  if (!payload) return;
  const cleanPath = String(storagePath || '').trim();
  if (!isPositiveInteger(payload.schemaVersion)) {
    addIssue(context.errors, 'invalid_storage_json_schema_version', `${label} has an invalid schemaVersion.`, {
      path: cleanPath,
      actual: payload.schemaVersion ?? '',
    });
  }
  if (options.revisionRequired && !isPositiveInteger(payload.revision)) {
    addIssue(context.errors, 'invalid_storage_json_revision', `${label} has an invalid revision.`, {
      path: cleanPath,
      actual: payload.revision ?? '',
    });
  }
  if (options.updatedAtRequired && !isPositiveInteger(payload.updatedAt)) {
    addIssue(context.errors, 'invalid_storage_json_updated_at', `${label} has an invalid updatedAt timestamp.`, {
      path: cleanPath,
      actual: payload.updatedAt ?? '',
    });
  }
}

function getStorageJsonEnvelopeOptions(expectedKind = '') {
  if (expectedKind === EXPECTED_STORAGE_JSON_KINDS.lorepackPayload || expectedKind === EXPECTED_STORAGE_JSON_KINDS.creatorProject) {
    return { revisionRequired: true, updatedAtRequired: true };
  }
  if (
    expectedKind === EXPECTED_STORAGE_JSON_KINDS.themePack
    || expectedKind === EXPECTED_STORAGE_JSON_KINDS.iconSet
    || expectedKind === EXPECTED_STORAGE_JSON_KINDS.repairSession
  ) {
    return { revisionRequired: false, updatedAtRequired: true };
  }
  return { revisionRequired: false, updatedAtRequired: false };
}

function getExpectedMimeForStoragePath(storagePath = '') {
  const extension = String(storagePath || '').split('.').pop()?.toLowerCase() || '';
  if (extension === 'json') return JSON_MIME;
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'avif') return 'image/avif';
  return '';
}

function getExpectedMasterIndexRecord(storagePath = '') {
  const direct = MASTER_INDEX_RECORD_EXPECTATIONS.get(storagePath);
  if (direct) return direct;

  const fileName = getSagaUserFilesFileName(storagePath);
  if (!fileName) return null;
  const versionedJsonSuffix = `.${SAGA_STORAGE_VERSION_SEGMENT}.${SAGA_STORAGE_JSON_EXTENSION}`;
  if (fileName.toLowerCase().endsWith(versionedJsonSuffix)) {
    for (const config of Object.values(SAGA_DOMAIN_STORAGE_CONFIGS)) {
      const payloadPattern = new RegExp(`^saga-${escapeRegExp(config.payloadFileKind)}-.+${escapeRegExp(versionedJsonSuffix)}$`, 'i');
      if (payloadPattern.test(fileName)) {
        return { kind: config.payloadRecordKind, domain: config.domain, mime: JSON_MIME, deletion: 'delete_with_owner' };
      }
    }
    if (/^saga-repair-session-.+\.v1\.json$/i.test(fileName)) {
      return { kind: 'loredeck_health_repair_session', domain: 'library', mime: JSON_MIME, deletion: 'delete_with_owner' };
    }
  }

  if (/^saga-pack-asset-.+\.(?:png|jpe?g|webp|avif)$/i.test(fileName)) {
    return { kind: 'lorepack_asset', domain: 'library', mime: getExpectedMimeForStoragePath(storagePath), deletion: 'delete_with_owner' };
  }
  if (/^saga-iconset-asset-.+\.(?:png|jpe?g|webp|avif)$/i.test(fileName)) {
    return { kind: 'iconset_asset', domain: 'iconSets', mime: getExpectedMimeForStoragePath(storagePath), deletion: 'delete_with_owner' };
  }

  return null;
}

function auditMasterIndexRecordMetadata(context, storagePath = '', record = {}) {
  const expected = getExpectedMasterIndexRecord(storagePath);
  if (!expected) return;
  const actual = {
    kind: String(record?.kind || ''),
    domain: String(record?.domain || ''),
  };
  if (actual.kind !== expected.kind || actual.domain !== expected.domain) {
    addIssue(context.errors, 'invalid_master_index_record_metadata', 'Master storage index classifies a Saga file with unexpected record metadata.', {
      path: storagePath,
      expected,
      actual,
    });
  }
  if (expected.mime && String(record?.mime || '') !== expected.mime) {
    addIssue(context.errors, 'invalid_master_index_record_mime', 'Master storage index records an unexpected MIME type for a Saga file.', {
      path: storagePath,
      expected: expected.mime,
      actual: String(record?.mime || ''),
    });
  }
  if (expected.deletion && String(record?.deletion || '') !== expected.deletion) {
    addIssue(context.errors, 'invalid_master_index_record_deletion', 'Master storage index records an unexpected deletion policy for a Saga file.', {
      path: storagePath,
      expected: expected.deletion,
      actual: String(record?.deletion || ''),
    });
  }
  auditMasterIndexRecordOwner(context, storagePath, 'Master storage index record', expected.ownerId);
}

function auditMasterDomainRecords(context, masterIndex = null) {
  if (!masterIndex) return;
  const domains = isPlainObject(masterIndex.domains) ? masterIndex.domains : null;
  if (!domains) {
    addIssue(context.errors, 'invalid_master_domains', 'Master storage index has an invalid domains block.');
    return;
  }

  const expectedDomains = new Set(Object.keys(SAGA_STORAGE_DOMAIN_INDEX_FILES));
  for (const domain of Object.keys(domains)) {
    if (!expectedDomains.has(domain)) {
      addIssue(context.errors, 'invalid_master_domain_key', 'Master storage index contains an unexpected domain key.', { domain });
    }
  }

  for (const [domain, expectedIndexFile] of Object.entries(SAGA_STORAGE_DOMAIN_INDEX_FILES)) {
    const record = domains[domain];
    if (!isPlainObject(record)) {
      addIssue(context.errors, 'missing_master_domain_record', 'Master storage index is missing a managed domain record.', { domain });
      continue;
    }
    const actualIndexFile = String(record.indexFile || '').trim();
    if (actualIndexFile !== expectedIndexFile) {
      addIssue(context.errors, 'invalid_master_domain_index_file', 'Master storage index domain record points at an unexpected index file.', {
        domain,
        expected: expectedIndexFile,
        actual: actualIndexFile,
      });
    }
    if (!isPositiveInteger(record.updatedAt)) {
      addIssue(context.errors, 'invalid_master_domain_updated_at', 'Master storage index domain record has an invalid updatedAt timestamp.', {
        domain,
        actual: record.updatedAt ?? '',
      });
    }
  }
}

function auditMasterIndexRecordOwner(context, storagePath = '', label = 'Saga storage file', expectedOwnerId = '') {
  const expected = normalizeSagaStorageId(expectedOwnerId, '', 160);
  if (!expected) return;
  const cleanPath = String(storagePath || '').trim();
  const record = context?.masterFiles?.[cleanPath];
  if (!record) return;
  const actual = record.ownerId ? normalizeSagaStorageId(record.ownerId, '', 160) : '';
  if (actual !== expected) {
    addIssue(context.errors, 'invalid_master_index_record_owner', `${label} has an unexpected master-index owner.`, {
      path: cleanPath,
      expected,
      actual,
    });
  }
}

function validateStoragePath(storagePath = '') {
  const cleanPath = String(storagePath || '').trim();
  if (!cleanPath.startsWith(SAGA_USER_FILES_PREFIX)) {
    return {
      ok: false,
      code: 'invalid_storage_ref',
      message: 'Path points outside /user/files.',
      path: cleanPath,
    };
  }
  const fileName = getSagaUserFilesFileName(cleanPath);
  if (!SAGA_STORAGE_FILE_RE.test(fileName)) {
    return {
      ok: false,
      code: 'invalid_storage_filename',
      message: 'Path is not a valid Saga storage filename.',
      path: cleanPath,
    };
  }
  return { ok: true, path: cleanPath };
}

async function auditStorageRef(context, storagePath, label, options = {}) {
  const { profileDir, trackedPaths, errors, warnings } = context;
  const cleanPath = String(storagePath || '').trim();
  if (!cleanPath) {
    if (options.required) addIssue(errors, 'missing_storage_ref', `${label} is missing a /user/files pointer.`);
    return null;
  }
  const validation = validateStoragePath(cleanPath);
  if (!validation.ok) {
    addIssue(errors, validation.code, `${label} ${validation.message}`, { path: validation.path });
    return null;
  }
  const exists = await pathExists(toProfileFilePath(profileDir, cleanPath));
  if (!exists) {
    addIssue(errors, 'missing_storage_file', `${label} points to a missing Saga file.`, { path: cleanPath });
  }
  if (options.registered !== false && !trackedPaths.has(cleanPath)) {
    const target = KNOWN_INDEX_PATHS.includes(cleanPath) ? warnings : errors;
    addIssue(target, 'untracked_storage_file', `${label} is not registered in the master Saga storage index.`, { path: cleanPath });
  }
  auditMasterIndexRecordOwner(context, cleanPath, label, options.expectedOwnerId);
  return { path: cleanPath, exists };
}

async function auditStorageJsonKind(context, storagePath, label, expectedKind, options = {}) {
  const ref = await auditStorageRef(context, storagePath, label, options);
  if (!ref?.exists || !expectedKind) return null;
  const payload = await readStorageJson(context.profileDir, ref.path, context, label);
  if (!payload) return null;
  auditStorageJsonEnvelope(context, payload, ref.path, label, getStorageJsonEnvelopeOptions(expectedKind));
  const actual = String(payload.kind || '');
  if (actual !== expectedKind) {
    addIssue(context.errors, 'invalid_storage_json_kind', `${label} has an unexpected kind.`, {
      path: ref.path,
      expected: expectedKind,
      actual,
    });
  }
  return payload;
}

function auditStorageJsonId(context, payload = null, storagePath = '', label = '', expectedId = '', idFields = []) {
  if (!payload || !expectedId || !Array.isArray(idFields) || !idFields.length) return;
  const actual = idFields
    .map(field => String(payload?.[field] || '').trim())
    .find(Boolean) || '';
  if (actual !== String(expectedId || '').trim()) {
    addIssue(context.errors, 'invalid_storage_json_id', `${label} identifies a different record than its domain index entry.`, {
      path: storagePath,
      expected: String(expectedId || '').trim(),
      actual,
      fields: idFields,
    });
  }
}

async function auditLibraryIndex(context, summary, index = null) {
  if (!index) return;
  auditDomainIndexKind(context, index, 'library', 'Library domain index', SAGA_STORAGE_DOMAIN_INDEX_FILES.library);
  const packs = isPlainObject(index.packs) ? index.packs : {};
  summary.external.library = {
    packCount: Object.keys(packs).length,
    packTypes: countByType(packs),
  };
  for (const [packId, pack] of Object.entries(packs)) {
    if (!pack?.payloadFile && pack?.type !== 'bundled') {
      addIssue(context.errors, 'library_pack_missing_payload', `Library pack ${packId} has no payloadFile.`);
    }
    const payload = await auditStorageJsonKind(context, pack?.payloadFile, `Library pack ${packId} payload`, EXPECTED_STORAGE_JSON_KINDS.lorepackPayload, { required: pack?.type !== 'bundled', expectedOwnerId: packId });
    auditStorageJsonId(context, payload, pack?.payloadFile, `Library pack ${packId} payload`, packId, ['packId', 'id']);
    if (pack?.coverFile) {
      await auditStorageRef(context, pack.coverFile, `Library pack ${packId} cover`, { expectedOwnerId: packId });
    }
    const recordBytes = jsonBytes(pack);
    if (recordBytes > 30000) {
      addIssue(context.warnings, 'large_library_index_record', `Library index record ${packId} is unusually large.`, { bytes: recordBytes });
    }
  }
}

async function auditCreatorIndex(context, summary, index = null) {
  if (!index) return;
  auditDomainIndexKind(context, index, 'creator', 'Creator domain index', SAGA_STORAGE_DOMAIN_INDEX_FILES.creator);
  const projects = isPlainObject(index.projects) ? index.projects : {};
  summary.external.creator = {
    projectCount: Object.keys(projects).length,
    activeProjectId: String(index.activeProjectId || index.activeJobId || ''),
  };
  for (const [projectId, project] of Object.entries(projects)) {
    const payload = await auditStorageJsonKind(context, project?.projectFile, `Creator project ${projectId} payload`, EXPECTED_STORAGE_JSON_KINDS.creatorProject, { required: true, expectedOwnerId: projectId });
    auditStorageJsonId(context, payload, project?.projectFile, `Creator project ${projectId} payload`, projectId, ['jobId', 'projectId', 'id']);
  }
}

async function auditThemeIndex(context, summary, index = null) {
  if (!index) return;
  auditDomainIndexKind(context, index, 'themes', 'Theme domain index', SAGA_STORAGE_DOMAIN_INDEX_FILES.themes);
  const packs = isPlainObject(index.packs) ? index.packs : {};
  summary.external.themes = {
    packCount: Object.keys(packs).length,
  };
  for (const [themeId, pack] of Object.entries(packs)) {
    const payload = await auditStorageJsonKind(context, pack?.payloadFile, `Theme Pack ${themeId} payload`, EXPECTED_STORAGE_JSON_KINDS.themePack, { required: true, expectedOwnerId: themeId });
    auditStorageJsonId(context, payload, pack?.payloadFile, `Theme Pack ${themeId} payload`, themeId, ['themeId', 'id']);
  }
}

async function auditIconIndex(context, summary, index = null) {
  if (!index) return;
  auditDomainIndexKind(context, index, 'iconSets', 'Icon Set domain index', SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets);
  const iconSets = isPlainObject(index.iconSets) ? index.iconSets : {};
  summary.external.iconSets = {
    iconSetCount: Object.keys(iconSets).length,
  };
  for (const [iconSetId, iconSet] of Object.entries(iconSets)) {
    const payload = await auditStorageJsonKind(context, iconSet?.payloadFile, `Icon Set ${iconSetId} payload`, EXPECTED_STORAGE_JSON_KINDS.iconSet, { required: true, expectedOwnerId: iconSetId });
    auditStorageJsonId(context, payload, iconSet?.payloadFile, `Icon Set ${iconSetId} payload`, iconSetId, ['iconSetId', 'id']);
    for (const [slot, iconPath] of Object.entries(isPlainObject(iconSet?.icons) ? iconSet.icons : {})) {
      const extension = String(iconPath || '').split('.').pop()?.toLowerCase() || '';
      if (SAGA_STORAGE_RASTER_ASSET_EXTENSIONS.includes(extension)) {
        await auditStorageRef(context, iconPath, `Icon Set ${iconSetId} asset ${slot}`, { expectedOwnerId: iconSetId });
      }
    }
  }
}

async function auditRepairSessions(context, summary, masterIndex = {}) {
  const records = Object.entries(masterIndex.files || {})
    .filter(([, record]) => record?.kind === 'loredeck_health_repair_session');
  const statuses = {};
  let autoDeletableCount = 0;
  for (const [sessionPath, record] of records) {
    const session = await auditStorageJsonKind(context, sessionPath, `Repair session ${sessionPath}`, EXPECTED_STORAGE_JSON_KINDS.repairSession);
    auditMasterIndexRecordOwner(context, sessionPath, `Repair session ${sessionPath}`, session?.packId || record?.ownerId || '');
    const status = String(session?.status || 'unknown');
    statuses[status] = (statuses[status] || 0) + 1;
    if (session?.lifecycle?.canAutoDelete === true) autoDeletableCount += 1;
  }
  summary.external.repairSessions = {
    count: records.length,
    statuses,
    autoDeletableCount,
  };
  if (autoDeletableCount) {
    addIssue(context.warnings, 'auto_deletable_repair_sessions', 'Completed repair sessions remain on disk and should be clearable from Health Center.', { count: autoDeletableCount });
  }
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usageText());
    return;
  }
  const profileDir = await resolveProfileDir(options.profile);
  const settingsPath = path.join(profileDir, 'settings.json');
  const userFilesDir = path.join(profileDir, 'user', 'files');
  const errors = [];
  const warnings = [];
  const settingsExists = await pathExists(settingsPath);
  if (!settingsExists) throw new Error(`settings.json was not found under ${profileDir}`);

  const settings = await readJsonFile(settingsPath);
  const saga = settings?.extension_settings?.saga || {};
  if (!isPlainObject(saga) || !Object.keys(saga).length) {
    addIssue(errors, 'missing_saga_settings', 'settings.json does not contain extension_settings.saga.');
  }

  const sagaFiles = await listSagaFiles(profileDir);
  const validSagaFiles = sagaFiles.filter(file => file.validStorageFile);
  const physicalPaths = new Set(validSagaFiles.map(file => file.path));
  const invalidJsonPaths = new Set();
  const context = { profileDir, trackedPaths: new Set(), masterFiles: {}, errors, warnings, invalidJsonPaths };
  const masterIndex = await readStorageJson(profileDir, SAGA_STORAGE_INDEX_PATH, context, 'Master storage index');
  const trackedPaths = new Set(Object.keys(masterIndex?.files || {}));
  context.trackedPaths = trackedPaths;
  context.masterFiles = isPlainObject(masterIndex?.files) ? masterIndex.files : {};
  const storageVersion = String(saga?.sagaStorage?.storageVersion || '');
  const libraryPacks = saga?.loredeckLibrary?.packs || {};
  const creatorJobs = saga?.loredeckCreatorProjects?.jobs || {};
  const themePacks = saga?.themePackLibrary?.packs || {};
  const iconSets = saga?.themeIconSetLibrary?.iconSets || {};
  const heavyHits = collectHeavySettingHits(saga)
    .filter(hit => !/^saga\.loredeckLibrary\.packs\.[^.]+\.library$/.test(hit.path))
    .slice(0, 25);
  const summary = {
    ok: false,
    profileDir,
    settings: {
      path: settingsPath,
      bytes: await statBytes(settingsPath),
      sagaBytes: jsonBytes(saga),
      sagaKeyCount: countObject(saga),
      storageVersion,
      expectedStorageVersion: SAGA_STORAGE_VERSION,
      compactShells: {
        loredeckLibraryPackCount: countObject(libraryPacks),
        loredeckLibraryPackTypes: countByType(libraryPacks),
        creatorJobCount: countObject(creatorJobs),
        themePackCount: countObject(themePacks),
        iconSetCount: countObject(iconSets),
      },
      storagePointerCount: collectStoragePointers(saga).size,
      heavySettingHits: heavyHits,
    },
    files: {
      userFilesDir,
      sagaFileCount: sagaFiles.length,
      sagaFileBytes: sagaFiles.reduce((sum, file) => sum + file.bytes, 0),
      physicalFiles: sagaFiles,
      trackedFileCount: trackedPaths.size,
      invalidFiles: [],
      missingTrackedFiles: [],
      orphanFiles: [],
    },
    external: {
      master: masterIndex ? {
        schemaVersion: masterIndex.schemaVersion,
        kind: masterIndex.kind,
        revision: masterIndex.revision,
        fileRecordCount: countObject(masterIndex.files),
      } : null,
    },
    warnings,
    errors,
  };

  if (storageVersion && storageVersion !== SAGA_STORAGE_VERSION) {
    addIssue(errors, 'unsupported_storage_version', 'Saga settings declare an unsupported storageVersion.', {
      storageVersion,
      expected: SAGA_STORAGE_VERSION,
    });
  }

  if (countObject(libraryPacks)) addIssue(errors, 'unsupported_settings_backed_library', 'Settings contain unsupported settings-backed Loredeck Library pack records. Reset Saga storage instead of migrating them.', { count: countObject(libraryPacks) });
  if (countObject(creatorJobs)) addIssue(errors, 'unsupported_settings_backed_creator', 'Settings contain unsupported settings-backed Creator project jobs. Reset Saga storage instead of migrating them.', { count: countObject(creatorJobs) });
  if (countObject(themePacks)) addIssue(errors, 'unsupported_settings_backed_themes', 'Settings contain unsupported settings-backed Theme Pack records. Reset Saga storage instead of migrating them.', { count: countObject(themePacks) });
  if (countObject(iconSets)) addIssue(errors, 'unsupported_settings_backed_iconsets', 'Settings contain unsupported settings-backed Icon Set records. Reset Saga storage instead of migrating them.', { count: countObject(iconSets) });

  for (const hit of heavyHits) {
    addIssue(errors, 'heavy_payload_in_settings', 'Settings contain a heavy Saga payload field.', hit);
  }

  for (const file of sagaFiles) {
    if (!file.validStorageFile) {
      summary.files.invalidFiles.push(file.path);
      addIssue(errors, 'invalid_saga_file', 'A saga-* file exists in /user/files but does not match allowed Saga storage filename or extension rules.', {
        path: file.path,
      });
    }
  }

  for (const file of validSagaFiles) {
    if (SAGA_JSON_FILE_RE.test(file.fileName)) {
      await readStorageJson(profileDir, file.path, context, `Saga JSON file ${file.fileName}`);
    }
  }

  if (!masterIndex && !physicalPaths.has(SAGA_STORAGE_INDEX_PATH) && validSagaFiles.some(file => SAGA_JSON_FILE_RE.test(file.fileName))) {
    addIssue(errors, 'missing_master_index', 'Saga JSON files exist but the master storage index is missing.');
  }
  if (masterIndex) {
    auditStorageJsonEnvelope(context, masterIndex, SAGA_STORAGE_INDEX_PATH, 'Master storage index', {
      revisionRequired: true,
      updatedAtRequired: true,
    });
    auditMasterDomainRecords(context, masterIndex);
  }
  if (masterIndex?.kind && masterIndex.kind !== 'saga_storage_index') {
    addIssue(errors, 'invalid_master_index_kind', 'Master storage index has an unexpected kind.', { kind: masterIndex.kind });
  }

  for (const storagePath of trackedPaths) {
    const validation = validateStoragePath(storagePath);
    if (!validation.ok) {
      addIssue(errors, 'invalid_master_index_record_path', `Master storage index contains an invalid file record path. ${validation.message}`, {
        path: validation.path,
      });
      continue;
    }
    auditMasterIndexRecordMetadata(context, storagePath, masterIndex?.files?.[storagePath]);
    if (!physicalPaths.has(storagePath)) {
      summary.files.missingTrackedFiles.push(storagePath);
      addIssue(errors, 'missing_tracked_file', 'A file registered in the master Saga storage index is missing on disk.', { path: storagePath });
    }
  }
  for (const storagePath of physicalPaths) {
    if (!trackedPaths.has(storagePath)) {
      summary.files.orphanFiles.push(storagePath);
      const target = KNOWN_INDEX_PATHS.includes(storagePath) ? warnings : errors;
      addIssue(target, 'orphan_saga_file', 'A Saga file exists in /user/files but is not registered in the master storage index.', { path: storagePath });
    }
  }

  const libraryIndex = await readStorageJson(profileDir, SAGA_STORAGE_DOMAIN_INDEX_FILES.library, context, 'Library domain index');
  const creatorIndex = await readStorageJson(profileDir, SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, context, 'Creator domain index');
  const themeIndex = await readStorageJson(profileDir, SAGA_STORAGE_DOMAIN_INDEX_FILES.themes, context, 'Theme domain index');
  const iconSetIndex = await readStorageJson(profileDir, SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets, context, 'Icon Set domain index');

  await auditStorageRef(context, SAGA_STORAGE_INDEX_PATH, 'Master storage index', { required: true, registered: false, expectedOwnerId: 'storage' });
  if (libraryIndex) await auditStorageRef(context, SAGA_STORAGE_DOMAIN_INDEX_FILES.library, 'Library domain index', { expectedOwnerId: 'library' });
  if (creatorIndex) await auditStorageRef(context, SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, 'Creator domain index', { expectedOwnerId: 'creator' });
  if (themeIndex) await auditStorageRef(context, SAGA_STORAGE_DOMAIN_INDEX_FILES.themes, 'Theme domain index', { expectedOwnerId: 'themes' });
  if (iconSetIndex) await auditStorageRef(context, SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets, 'Icon Set domain index', { expectedOwnerId: 'iconSets' });

  await auditLibraryIndex(context, summary, libraryIndex);
  await auditCreatorIndex(context, summary, creatorIndex);
  await auditThemeIndex(context, summary, themeIndex);
  await auditIconIndex(context, summary, iconSetIndex);
  await auditRepairSessions(context, summary, masterIndex || {});

  summary.ok = errors.length === 0;

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Saga storage profile audit: ${summary.ok ? 'PASS' : 'FAIL'}`);
    console.log(`Profile: ${summary.profileDir}`);
    console.log(`Settings: ${summary.settings.bytes} bytes (${summary.settings.sagaBytes} Saga bytes)`);
    console.log(`Files: ${summary.files.sagaFileCount} Saga files, ${summary.files.trackedFileCount} tracked`);
    if (warnings.length) console.log(`Warnings: ${warnings.length}`);
    if (errors.length) console.log(`Errors: ${errors.length}`);
  }

  if (!summary.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
