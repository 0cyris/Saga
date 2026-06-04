import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = 'Lorepacks/hp-golden-trio';
const DAY_MS = 86400000;

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function parseIsoDate(value = '') {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const check = new Date(epoch);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return {
    year,
    month,
    day,
    iso: `${year}-${pad2(month)}-${pad2(day)}`,
    epoch,
    sortKey: Math.floor(epoch / DAY_MS),
  };
}

function listJsonFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.isFile() && entry.name.endsWith('.json') ? [full] : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sortObjectKeysForPosition(position) {
  const ordered = {};
  for (const key of [
    'sortKeyFrom',
    'sortKeyTo',
    'precision',
    'label',
    'approximate',
  ]) {
    if (position[key] !== undefined && position[key] !== null && position[key] !== '') ordered[key] = position[key];
  }
  return ordered;
}

export function getEntryDateRange(entry = {}) {
  const date = entry.date && typeof entry.date === 'object' && !Array.isArray(entry.date) ? entry.date : {};
  const from = String(date.validFrom || entry.validFrom || '').trim();
  const to = String(date.validTo || entry.validTo || from || '').trim();
  return {
    from,
    to,
    precision: String(date.precision || 'date').trim() || 'date',
  };
}

export function buildPositionFromDateRange(range = {}) {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to || range.from);
  if (!from || !to) return null;
  const sortKeyFrom = Math.min(from.sortKey, to.sortKey);
  const sortKeyTo = Math.max(from.sortKey, to.sortKey);
  const sameDay = from.iso === to.iso;
  return sortObjectKeysForPosition({
    sortKeyFrom,
    sortKeyTo,
    precision: sameDay ? 'date_anchor' : 'date_window',
    label: sameDay ? from.iso : `${from.iso} to ${to.iso}`,
    approximate: range.precision && range.precision !== 'date',
  });
}

function shouldSkipFile(file) {
  const normalized = file.replace(/\\/g, '/');
  return normalized.endsWith('/timeline.json')
    || normalized.endsWith('/lorepack.json')
    || normalized.endsWith('/manifest.json')
    || normalized.endsWith('/index.json')
    || normalized.endsWith('/taxonomy.json')
    || normalized.endsWith('/gate-types.json')
    || normalized.endsWith('/scoring.json');
}

export function migrateEntryToPosition(entry = {}, options = {}) {
  const hasPosition = entry.position && typeof entry.position === 'object' && !Array.isArray(entry.position) && Object.keys(entry.position).length > 0;
  if (hasPosition && !options.force) {
    return { entry, changed: false, status: 'already_positioned' };
  }
  const range = getEntryDateRange(entry);
  const position = buildPositionFromDateRange(range);
  if (!position) {
    return { entry, changed: false, status: range.from || range.to ? 'invalid_date' : 'no_date' };
  }
  return {
    entry: {
      ...entry,
      position,
    },
    changed: true,
    status: 'position_added',
  };
}

export function migrateLorepackRoot(root = DEFAULT_ROOT, options = {}) {
  const files = listJsonFiles(root).filter(file => !shouldSkipFile(file));
  const report = {
    root,
    fileCount: 0,
    entryCount: 0,
    changedEntryCount: 0,
    alreadyPositionedCount: 0,
    invalidDateCount: 0,
    noDateCount: 0,
    changedFiles: [],
  };

  for (const file of files) {
    let json;
    try {
      json = readJson(file);
    } catch (_) {
      continue;
    }
    const entries = Array.isArray(json.entries) ? json.entries : null;
    if (!entries) continue;
    report.fileCount += 1;
    let fileChanged = false;
    const nextEntries = entries.map(entry => {
      report.entryCount += 1;
      const result = migrateEntryToPosition(entry, options);
      if (result.status === 'already_positioned') report.alreadyPositionedCount += 1;
      if (result.status === 'invalid_date') report.invalidDateCount += 1;
      if (result.status === 'no_date') report.noDateCount += 1;
      if (result.changed) {
        fileChanged = true;
        report.changedEntryCount += 1;
      }
      return result.entry;
    });
    if (fileChanged) {
      const relative = path.relative(root, file);
      report.changedFiles.push(relative);
      if (options.write) {
        fs.writeFileSync(file, `${JSON.stringify({ ...json, entries: nextEntries }, null, 2)}\n`);
      }
    }
  }

  return report;
}

function parseArgs(argv = []) {
  const args = new Set(argv);
  const rootIndex = argv.findIndex(arg => arg === '--root');
  return {
    root: rootIndex >= 0 ? argv[rootIndex + 1] || DEFAULT_ROOT : DEFAULT_ROOT,
    write: args.has('--write'),
    force: args.has('--force'),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = migrateLorepackRoot(options.root, options);
  console.log(JSON.stringify({
    ...report,
    mode: options.write ? 'write' : 'dry-run',
    note: options.write
      ? 'Position metadata was written. Date fields were preserved for this migration slice.'
      : 'Dry run only. Pass --write to annotate entries with position metadata.',
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
