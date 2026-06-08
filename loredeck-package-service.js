/**
 * loredeck-package-service.js -- Saga
 * Loredeck package parsing and validation helpers layered on the safe ZIP utility.
 */

import {
  assertSafeZipEntryPath,
  createStoredZipArchive,
  normalizeZipEntryPath,
  readZipArchive,
} from './loredeck-package-zip.js';

const PACKAGE_META_PATH = 'saga-package.json';
const LOREDECK_INDEX_PATH = 'Loredecks/index.json';
const LEGACY_ROOT_MANIFEST_PATH = 'loredeck.json';

function cloneJson(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
}

function cleanString(value = '', maxLength = 1000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizePackId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

function dirname(path = '') {
  const normalized = String(path || '').replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(0, index + 1) : '';
}

function joinZipPath(base = '', child = '') {
  const raw = String(child || '').replace(/\\/g, '/').trim();
  if (!raw) return '';
  if (raw.startsWith('Loredecks/')) return assertSafeZipEntryPath(raw);
  return assertSafeZipEntryPath(`${base}${raw}`);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function normalizeIndexRecords(index = {}) {
  const records = asArray(index.loredecks).length
    ? asArray(index.loredecks)
    : asArray(index.bundled);
  return records
    .filter(record => record && typeof record === 'object' && !Array.isArray(record))
    .map(record => cloneJson(record) || {});
}

function getManifestRefForRecord(record = {}) {
  const packId = normalizePackId(record.packId || record.id);
  const manifest = cleanString(record.manifest || '', 500).replace(/\\/g, '/');
  if (manifest) return manifest.startsWith('Loredecks/') ? manifest : `Loredecks/${manifest}`;
  return packId ? `Loredecks/${packId}/loredeck.json` : '';
}

function getManifestFileRefs(manifest = {}) {
  const files = Array.isArray(manifest.files) ? manifest.files : [];
  const refs = [];
  for (const item of files) {
    const raw = typeof item === 'string'
      ? item
      : (item && typeof item === 'object' ? item.file || item.path || item.url || '' : '');
    const ref = cleanString(raw, 500).replace(/\\/g, '/');
    if (ref && !/^https?:\/\//i.test(ref) && !ref.startsWith('data:')) refs.push(ref);
  }
  return refs;
}

function getAssetRefs(record = {}, manifest = {}) {
  const assets = [
    record.assets && typeof record.assets === 'object' && !Array.isArray(record.assets) ? record.assets : {},
    manifest.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets) ? manifest.assets : {},
  ];
  const refs = [];
  for (const source of assets) {
    for (const [key, raw] of Object.entries(source)) {
      const asset = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
      const path = cleanString(asset.path || '', 500).replace(/\\/g, '/');
      if (path && !/^https?:\/\//i.test(path) && !path.startsWith('data:')) {
        refs.push({ key, path, asset: cloneJson(asset) || {} });
      }
    }
  }
  return refs;
}

async function readOptionalJson(archive, path) {
  if (!archive.has(path)) return null;
  return archive.readJson(path);
}

export async function parseLoredeckZipPackage(input, options = {}) {
  const archive = await readZipArchive(input, options);
  const packageMeta = await readOptionalJson(archive, PACKAGE_META_PATH) || {
    packageSchemaVersion: 1,
    packageType: 'saga_loredeck_package',
    title: '',
  };
  let index = await readOptionalJson(archive, LOREDECK_INDEX_PATH);
  let compatibilityRootManifest = null;
  const warnings = [];

  if (!index && archive.has(LEGACY_ROOT_MANIFEST_PATH)) {
    compatibilityRootManifest = await archive.readJson(LEGACY_ROOT_MANIFEST_PATH);
    const id = normalizePackId(compatibilityRootManifest.id || compatibilityRootManifest.packId || 'imported-loredeck');
    index = {
      schemaVersion: 1,
      loredecks: [{
        packId: id,
        manifest: LEGACY_ROOT_MANIFEST_PATH,
        title: compatibilityRootManifest.title || id,
        type: compatibilityRootManifest.type || 'custom',
      }],
    };
    warnings.push('Package uses legacy root loredeck.json shape; import will normalize it as a Custom Loredeck.');
  }

  if (!index) {
    throw new Error('Loredeck package is missing Loredecks/index.json.');
  }

  const indexRecords = normalizeIndexRecords(index);
  if (!indexRecords.length) {
    throw new Error('Loredeck package index does not list any Loredecks.');
  }

  const decks = [];
  const failures = [];
  for (const record of indexRecords) {
    try {
      const originalPackId = normalizePackId(record.packId || record.id);
      if (!originalPackId) throw new Error('Index record is missing packId.');
      const manifestPath = assertSafeZipEntryPath(getManifestRefForRecord(record));
      if (!archive.has(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
      const manifest = manifestPath === LEGACY_ROOT_MANIFEST_PATH && compatibilityRootManifest
        ? compatibilityRootManifest
        : await archive.readJson(manifestPath);
      const deckRoot = dirname(manifestPath);
      const fileRefs = [];
      const missingFiles = [];
      for (const ref of getManifestFileRefs(manifest)) {
        const resolved = joinZipPath(deckRoot, ref);
        if (archive.has(resolved)) fileRefs.push(resolved);
        else missingFiles.push(resolved);
      }
      const assetRefs = [];
      const missingAssets = [];
      for (const ref of getAssetRefs(record, manifest)) {
        const resolved = joinZipPath(deckRoot, ref.path);
        if (archive.has(resolved)) assetRefs.push({ ...ref, resolvedPath: resolved });
        else missingAssets.push(resolved);
      }
      decks.push({
        originalPackId,
        manifestPath,
        deckRoot,
        indexRecord: record,
        manifest,
        fileRefs,
        assetRefs,
        missingFiles,
        missingAssets,
        importType: 'custom',
      });
    } catch (e) {
      failures.push({
        record,
        error: e?.message || 'Deck package record could not be parsed.',
      });
    }
  }

  return {
    archive,
    packageMeta,
    index,
    decks,
    failures,
    warnings,
    folderCount: asArray(index.folders).length,
    deckCount: decks.length,
    entryCountHint: decks.reduce((sum, deck) => sum + (Number(deck.indexRecord?.stats?.entryCount || deck.manifest?.stats?.entryCount) || 0), 0),
  };
}

export async function createLoredeckZipPackage(files = [], options = {}) {
  const normalized = [];
  const seen = new Set();
  for (const file of files || []) {
    const path = normalizeZipEntryPath(file?.path || file?.name || '');
    if (!path) throw new Error(`Invalid package file path: ${file?.path || file?.name || ''}`);
    if (seen.has(path)) throw new Error(`Duplicate package file path: ${path}`);
    seen.add(path);
    normalized.push({ path, data: file?.data ?? file?.bytes ?? '' });
  }
  return createStoredZipArchive(normalized, options);
}
