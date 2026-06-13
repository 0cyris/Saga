/**
 * Flat Saga storage filename helpers.
 *
 * SillyTavern's built-in files endpoint accepts filenames, not paths, so Saga
 * storage files must be flat, prefixed, and self-describing.
 */

export const SAGA_USER_FILES_PREFIX = '/user/files/';
export const SAGA_STORAGE_FILE_PREFIX = 'saga-';
export const SAGA_STORAGE_VERSION_SEGMENT = 'v1';

const SAGA_STORAGE_FILENAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const MAX_FILENAME_LENGTH = 180;
const MAX_STEM_LENGTH = 96;

const BLOCKED_STORAGE_EXTENSIONS = new Set([
    'bat',
    'cmd',
    'com',
    'dll',
    'exe',
    'hta',
    'htm',
    'html',
    'jar',
    'js',
    'jse',
    'mjs',
    'msi',
    'ps1',
    'scr',
    'sh',
    'svg',
    'vbe',
    'vbs',
    'wasm',
]);

export const SAGA_STORAGE_JSON_EXTENSION = 'json';
export const SAGA_STORAGE_RASTER_ASSET_EXTENSIONS = Object.freeze(['png', 'webp', 'jpg', 'jpeg', 'avif']);

function cleanExtension(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^\.+/, '')
        .replace(/[^a-z0-9]+/g, '');
}

function trimStorageStem(value = '', fallback = 'item', maxLength = MAX_STEM_LENGTH) {
    const text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/[._-]{2,}/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, Math.max(1, Number(maxLength) || MAX_STEM_LENGTH))
        .replace(/^[._-]+|[._-]+$/g, '');
    return text || fallback;
}

export function normalizeSagaStorageId(value = '', fallback = 'item', maxLength = MAX_STEM_LENGTH) {
    return trimStorageStem(value, fallback, maxLength);
}

export function normalizeSagaAssetRole(value = '', fallback = 'asset', maxLength = 48) {
    return trimStorageStem(String(value || '').replace(/[.]+/g, '-'), fallback, maxLength);
}

export function normalizeSagaStorageHash(value = '', maxLength = 16) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-f0-9]+/g, '')
        .slice(0, Math.max(1, Number(maxLength) || 16));
}

export function getSagaStorageFileExtension(fileName = '') {
    const text = String(fileName || '').trim();
    const index = text.lastIndexOf('.');
    return index >= 0 && index < text.length - 1 ? cleanExtension(text.slice(index + 1)) : '';
}

export function validateSagaStorageFileName(fileName = '', options = {}) {
    const name = String(fileName || '').trim();
    if (!name) return { ok: false, fileName: '', error: 'Saga storage filename is required.' };
    if (name.length > (Number(options.maxLength) || MAX_FILENAME_LENGTH)) {
        return { ok: false, fileName: name, error: 'Saga storage filename is too long.' };
    }
    if (!name.startsWith(SAGA_STORAGE_FILE_PREFIX)) {
        return { ok: false, fileName: name, error: 'Saga storage filename must start with saga-.' };
    }
    if (name.startsWith('.') || name.endsWith('.')) {
        return { ok: false, fileName: name, error: 'Saga storage filename cannot start or end with a dot.' };
    }
    if (name.includes('..')) {
        return { ok: false, fileName: name, error: 'Saga storage filename cannot contain dot-dot segments.' };
    }
    if (!SAGA_STORAGE_FILENAME_PATTERN.test(name)) {
        return { ok: false, fileName: name, error: 'Saga storage filename must be flat and contain only letters, numbers, _, -, and dots.' };
    }
    const extension = getSagaStorageFileExtension(name);
    if (!extension) return { ok: false, fileName: name, error: 'Saga storage filename must include an extension.' };
    if (BLOCKED_STORAGE_EXTENSIONS.has(extension)) {
        return { ok: false, fileName: name, error: `Saga storage filename uses a blocked extension: ${extension}.` };
    }
    if (Array.isArray(options.allowedExtensions) && options.allowedExtensions.length) {
        const allowed = new Set(options.allowedExtensions.map(cleanExtension).filter(Boolean));
        if (!allowed.has(extension)) {
            return { ok: false, fileName: name, error: `Saga storage filename extension is not allowed: ${extension}.` };
        }
    }
    return { ok: true, fileName: name, error: '' };
}

export function assertSagaStorageFileName(fileName = '', options = {}) {
    const result = validateSagaStorageFileName(fileName, options);
    if (!result.ok) throw new Error(result.error);
    return result.fileName;
}

export function toSagaUserFilesPath(fileName = '', options = {}) {
    const validName = assertSagaStorageFileName(fileName, options);
    return `${SAGA_USER_FILES_PREFIX}${validName}`;
}

export function getSagaUserFilesFileName(path = '') {
    const text = String(path || '').trim();
    if (!text.startsWith(SAGA_USER_FILES_PREFIX)) return '';
    return text.slice(SAGA_USER_FILES_PREFIX.length);
}

export function validateSagaUserFilesPath(path = '', options = {}) {
    const fileName = getSagaUserFilesFileName(path);
    if (!fileName) {
        return { ok: false, path: String(path || '').trim(), fileName: '', error: 'Saga storage path must be under /user/files/.' };
    }
    const nameResult = validateSagaStorageFileName(fileName, options);
    return nameResult.ok
        ? { ok: true, path: `${SAGA_USER_FILES_PREFIX}${nameResult.fileName}`, fileName: nameResult.fileName, error: '' }
        : { ok: false, path: String(path || '').trim(), fileName, error: nameResult.error };
}

export function assertSagaUserFilesPath(path = '', options = {}) {
    const result = validateSagaUserFilesPath(path, options);
    if (!result.ok) throw new Error(result.error);
    return result.path;
}

export function buildSagaJsonStorageFileName(kind = '', id = '', options = {}) {
    const cleanKind = normalizeSagaStorageId(kind, 'record', 48);
    const cleanId = normalizeSagaStorageId(id, cleanKind, options.idMaxLength || MAX_STEM_LENGTH);
    const version = normalizeSagaStorageId(options.version || SAGA_STORAGE_VERSION_SEGMENT, SAGA_STORAGE_VERSION_SEGMENT, 16);
    return assertSagaStorageFileName(`${SAGA_STORAGE_FILE_PREFIX}${cleanKind}-${cleanId}.${version}.${SAGA_STORAGE_JSON_EXTENSION}`, {
        allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
    });
}

export function buildSagaIndexStorageFileName(domain = '', options = {}) {
    const cleanDomain = normalizeSagaStorageId(domain, 'storage', 48);
    const version = normalizeSagaStorageId(options.version || SAGA_STORAGE_VERSION_SEGMENT, SAGA_STORAGE_VERSION_SEGMENT, 16);
    return assertSagaStorageFileName(`${SAGA_STORAGE_FILE_PREFIX}${cleanDomain}-index.${version}.${SAGA_STORAGE_JSON_EXTENSION}`, {
        allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
    });
}

export function buildSagaAssetStorageFileName(domain = '', ownerId = '', role = '', extension = '', options = {}) {
    const cleanDomain = normalizeSagaStorageId(domain, 'asset', 36);
    const cleanOwner = normalizeSagaStorageId(ownerId, 'owner', options.ownerMaxLength || 72);
    const cleanRole = normalizeSagaAssetRole(role, 'asset', 48);
    const cleanHash = normalizeSagaStorageHash(options.hash || options.sha256 || '', 16);
    const cleanExt = cleanExtension(extension);
    if (!SAGA_STORAGE_RASTER_ASSET_EXTENSIONS.includes(cleanExt)) {
        throw new Error(`Saga storage asset extension is not allowed: ${cleanExt || '(missing)'}.`);
    }
    const hashSegment = cleanHash ? `-${cleanHash}` : '';
    return assertSagaStorageFileName(`${SAGA_STORAGE_FILE_PREFIX}${cleanDomain}-asset-${cleanOwner}-${cleanRole}${hashSegment}.${cleanExt}`, {
        allowedExtensions: SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
    });
}
