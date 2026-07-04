/**
 * loredeck-package-zip.js -- Saga
 * Small data-only ZIP reader/writer for Loredeck package transport.
 */

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP_METHOD_STORE = 0;
const ZIP_METHOD_DEFLATE = 8;
const ZIP_FLAG_ENCRYPTED = 0x0001;
const ZIP_FLAG_UTF8 = 0x0800;
const ZIP_UNIX_SYMLINK_MODE = 0xA000;

const DEFAULT_ZIP_LIMITS = Object.freeze({
  maxFileCount: 2000,
  maxCompressedBytes: 250 * 1024 * 1024,
  maxUncompressedBytes: 500 * 1024 * 1024,
  maxSingleFileBytes: 50 * 1024 * 1024,
});

const BLOCKED_ZIP_EXTENSIONS = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.hta',
  '.htm',
  '.html',
  '.jar',
  '.js',
  '.jse',
  '.mjs',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vbe',
  '.vbs',
  '.wasm',
]);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

let crcTable = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

export function crc32Bytes(bytes) {
  const table = getCrcTable();
  let crc = 0xFFFFFFFF;
  for (const byte of bytes || []) {
    crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function getZipExtension(path = '') {
  const clean = String(path || '').toLowerCase();
  const index = clean.lastIndexOf('.');
  return index >= 0 ? clean.slice(index) : '';
}

export function normalizeZipEntryPath(value = '') {
  const raw = String(value || '').replace(/\\/g, '/').trim();
  if (!raw) return '';
  const path = raw.replace(/^\.\/+/, '');
  const isDirectory = path.endsWith('/');
  const pathForSegments = isDirectory ? path.slice(0, -1) : path;
  if (
    !pathForSegments
    || path.includes('\0')
    || path.startsWith('/')
    || path.startsWith('//')
    || /^[A-Za-z]:\//.test(path)
  ) {
    return '';
  }
  const parts = pathForSegments.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return '';
  return `${parts.join('/')}${isDirectory ? '/' : ''}`;
}

export function validateZipEntryPath(value = '', options = {}) {
  const normalized = normalizeZipEntryPath(value);
  if (!normalized) {
    return { ok: false, path: '', error: `Unsafe zip entry path: ${String(value || '').slice(0, 120)}` };
  }
  if (normalized.endsWith('/')) {
    return { ok: true, path: normalized, error: '' };
  }
  const extension = getZipExtension(normalized);
  const blocked = options.blockedExtensions || BLOCKED_ZIP_EXTENSIONS;
  if (blocked.has(extension)) {
    return { ok: false, path: normalized, error: `Unsupported executable zip entry type: ${extension}` };
  }
  return { ok: true, path: normalized, error: '' };
}

export function assertSafeZipEntryPath(value = '', options = {}) {
  const result = validateZipEntryPath(value, options);
  if (!result.ok) throw new Error(result.error);
  return result.path;
}

async function toUint8Array(input) {
  if (input instanceof Uint8Array) return input;
  if (typeof input === 'string') return textEncoder.encode(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  if (input && typeof input.arrayBuffer === 'function') {
    return new Uint8Array(await input.arrayBuffer());
  }
  throw new Error('Zip data must be a string, Blob, ArrayBuffer, or Uint8Array.');
}

function readUint16(view, offset) {
  return view.getUint16(offset, true);
}

function readUint32(view, offset) {
  return view.getUint32(offset, true);
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xFF;
  bytes[offset + 1] = (value >>> 8) & 0xFF;
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xFF;
  bytes[offset + 1] = (value >>> 8) & 0xFF;
  bytes[offset + 2] = (value >>> 16) & 0xFF;
  bytes[offset + 3] = (value >>> 24) & 0xFF;
}

function concatBytes(chunks) {
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function dateToDosTime(date = new Date()) {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return {
    time: (hours << 11) | (minutes << 5) | seconds,
    date: ((year - 1980) << 9) | (month << 5) | day,
  };
}

function findEndOfCentralDirectory(bytes) {
  const min = Math.max(0, bytes.length - 0xFFFF - 22);
  for (let offset = bytes.length - 22; offset >= min; offset -= 1) {
    if (
      bytes[offset] === 0x50
      && bytes[offset + 1] === 0x4B
      && bytes[offset + 2] === 0x05
      && bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
}

async function inflateRawZipBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('This runtime cannot inflate compressed zip entries.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function createZipEntryRecord(archive, raw = {}) {
  return {
    path: raw.path,
    isDirectory: raw.isDirectory,
    compressionMethod: raw.compressionMethod,
    compressedSize: raw.compressedSize,
    uncompressedSize: raw.uncompressedSize,
    crc32: raw.crc32,
    flags: raw.flags,
    async bytes() {
      return archive.readFileBytes(raw.path);
    },
    async text() {
      return textDecoder.decode(await archive.readFileBytes(raw.path));
    },
    async json() {
      return JSON.parse(await this.text());
    },
  };
}

export async function readZipArchive(input, options = {}) {
  const limits = { ...DEFAULT_ZIP_LIMITS, ...(options.limits || {}) };
  const bytes = await toUint8Array(input);
  if (bytes.length > limits.maxCompressedBytes) {
    throw new Error(`Zip package is too large (${bytes.length} bytes).`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error('Zip package is missing a central directory.');
  if (readUint32(view, eocdOffset) !== ZIP_END_OF_CENTRAL_DIRECTORY) {
    throw new Error('Zip package central directory is invalid.');
  }

  const diskNumber = readUint16(view, eocdOffset + 4);
  const centralDirectoryDisk = readUint16(view, eocdOffset + 6);
  const entryCount = readUint16(view, eocdOffset + 10);
  const centralDirectorySize = readUint32(view, eocdOffset + 12);
  const centralDirectoryOffset = readUint32(view, eocdOffset + 16);
  if (diskNumber !== 0 || centralDirectoryDisk !== 0) {
    throw new Error('Multi-disk zip packages are not supported.');
  }
  if (entryCount > limits.maxFileCount) {
    throw new Error(`Zip package contains too many files (${entryCount}).`);
  }
  if (centralDirectoryOffset + centralDirectorySize > bytes.length) {
    throw new Error('Zip package central directory points outside the archive.');
  }

  const records = [];
  const byPath = new Map();
  let totalUncompressed = 0;
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(view, offset) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error('Zip package central directory contains an invalid file header.');
    }
    const flags = readUint16(view, offset + 8);
    const compressionMethod = readUint16(view, offset + 10);
    const crc32 = readUint32(view, offset + 16);
    const compressedSize = readUint32(view, offset + 20);
    const uncompressedSize = readUint32(view, offset + 24);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const externalAttrs = readUint32(view, offset + 38);
    const localHeaderOffset = readUint32(view, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > bytes.length) throw new Error('Zip package contains a truncated file name.');
    const rawPath = textDecoder.decode(bytes.slice(nameStart, nameEnd));
    const normalized = assertSafeZipEntryPath(rawPath, options);
    const isDirectory = normalized.endsWith('/') || rawPath.endsWith('/');
    const unixMode = (externalAttrs >>> 16) & 0xF000;
    if (unixMode === ZIP_UNIX_SYMLINK_MODE) {
      throw new Error(`Zip package contains an unsupported symlink: ${normalized}`);
    }
    if (flags & ZIP_FLAG_ENCRYPTED) {
      throw new Error(`Zip package contains an encrypted entry: ${normalized}`);
    }
    if (compressionMethod !== ZIP_METHOD_STORE && compressionMethod !== ZIP_METHOD_DEFLATE) {
      throw new Error(`Zip entry uses unsupported compression method ${compressionMethod}: ${normalized}`);
    }
    if (uncompressedSize > limits.maxSingleFileBytes) {
      throw new Error(`Zip entry is too large: ${normalized}`);
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxUncompressedBytes) {
      throw new Error('Zip package expands beyond the configured safety limit.');
    }
    if (localHeaderOffset >= bytes.length) {
      throw new Error(`Zip entry points outside the archive: ${normalized}`);
    }
    if (byPath.has(normalized)) {
      throw new Error(`Zip package contains duplicate entry path: ${normalized}`);
    }
    const record = {
      path: normalized,
      isDirectory,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      crc32,
      flags,
      utf8: !!(flags & ZIP_FLAG_UTF8),
      localHeaderOffset,
    };
    records.push(record);
    byPath.set(normalized, record);
    offset = nameEnd + extraLength + commentLength;
  }

  const archive = {
    entries: [],
    has(path) {
      const normalized = normalizeZipEntryPath(path);
      return !!normalized && byPath.has(normalized);
    },
    getEntry(path) {
      const normalized = normalizeZipEntryPath(path);
      return normalized ? this.entries.find(entry => entry.path === normalized) || null : null;
    },
    async readFileBytes(path) {
      const normalized = assertSafeZipEntryPath(path, options);
      const record = byPath.get(normalized);
      if (!record) throw new Error(`Zip package is missing file: ${normalized}`);
      if (record.isDirectory) return new Uint8Array();
      const localOffset = record.localHeaderOffset;
      if (readUint32(view, localOffset) !== ZIP_LOCAL_FILE_HEADER) {
        throw new Error(`Zip entry has an invalid local file header: ${normalized}`);
      }
      const localNameLength = readUint16(view, localOffset + 26);
      const localExtraLength = readUint16(view, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + record.compressedSize;
      if (dataEnd > bytes.length) throw new Error(`Zip entry data is truncated: ${normalized}`);
      const compressed = bytes.slice(dataStart, dataEnd);
      const output = record.compressionMethod === ZIP_METHOD_STORE
        ? compressed
        : await inflateRawZipBytes(compressed);
      if (output.length !== record.uncompressedSize) {
        throw new Error(`Zip entry size mismatch after extraction: ${normalized}`);
      }
      const computed = crc32Bytes(output);
      if (computed !== record.crc32) {
        throw new Error(`Zip entry CRC mismatch: ${normalized}`);
      }
      return output;
    },
    async readText(path) {
      return textDecoder.decode(await this.readFileBytes(path));
    },
    async readJson(path) {
      return JSON.parse(await this.readText(path));
    },
  };
  archive.entries = records.map(record => createZipEntryRecord(archive, record));
  return archive;
}

export async function createStoredZipArchive(files = [], options = {}) {
  const now = options.date instanceof Date ? options.date : new Date();
  const dos = dateToDosTime(now);
  const localChunks = [];
  const centralChunks = [];
  const records = [];
  let localOffset = 0;

  for (const file of files || []) {
    const path = assertSafeZipEntryPath(file?.path || file?.name || '', options);
    if (path.endsWith('/')) continue;
    const nameBytes = textEncoder.encode(path);
    const data = await toUint8Array(file?.data ?? file?.bytes ?? '');
    const crc = crc32Bytes(data);
    const local = new Uint8Array(30 + nameBytes.length);
    writeUint32(local, 0, ZIP_LOCAL_FILE_HEADER);
    writeUint16(local, 4, 20);
    writeUint16(local, 6, ZIP_FLAG_UTF8);
    writeUint16(local, 8, ZIP_METHOD_STORE);
    writeUint16(local, 10, dos.time);
    writeUint16(local, 12, dos.date);
    writeUint32(local, 14, crc);
    writeUint32(local, 18, data.length);
    writeUint32(local, 22, data.length);
    writeUint16(local, 26, nameBytes.length);
    writeUint16(local, 28, 0);
    local.set(nameBytes, 30);
    localChunks.push(local, data);
    records.push({ path, nameBytes, crc, size: data.length, offset: localOffset });
    localOffset += local.length + data.length;
  }

  let centralSize = 0;
  for (const record of records) {
    const central = new Uint8Array(46 + record.nameBytes.length);
    writeUint32(central, 0, ZIP_CENTRAL_DIRECTORY_HEADER);
    writeUint16(central, 4, 20);
    writeUint16(central, 6, 20);
    writeUint16(central, 8, ZIP_FLAG_UTF8);
    writeUint16(central, 10, ZIP_METHOD_STORE);
    writeUint16(central, 12, dos.time);
    writeUint16(central, 14, dos.date);
    writeUint32(central, 16, record.crc);
    writeUint32(central, 20, record.size);
    writeUint32(central, 24, record.size);
    writeUint16(central, 28, record.nameBytes.length);
    writeUint16(central, 30, 0);
    writeUint16(central, 32, 0);
    writeUint16(central, 34, 0);
    writeUint16(central, 36, 0);
    writeUint32(central, 38, 0);
    writeUint32(central, 42, record.offset);
    central.set(record.nameBytes, 46);
    centralChunks.push(central);
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  writeUint32(end, 0, ZIP_END_OF_CENTRAL_DIRECTORY);
  writeUint16(end, 4, 0);
  writeUint16(end, 6, 0);
  writeUint16(end, 8, records.length);
  writeUint16(end, 10, records.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, localOffset);
  writeUint16(end, 20, 0);

  return concatBytes([...localChunks, ...centralChunks, end]);
}

export function createZipBlob(bytes, type = 'application/zip') {
  return new Blob([bytes], { type });
}
