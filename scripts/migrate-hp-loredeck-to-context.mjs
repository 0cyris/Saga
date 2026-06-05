import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = 'Loredecks/hp-golden-trio';
const DAY_MS = 86400000;
const ENTRY_SCHEMA_VERSION = 3;
const SERIES_END_ISO = '1998-08-31';
const NON_ENTRY_FILES = new Set([
  'timeline.json',
  'loredeck.json',
  'manifest.json',
  'index.json',
  'taxonomy.json',
  'gate-types.json',
  'scoring.json',
]);

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function cleanString(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanLegacyTerminology(value = '') {
  return String(value || '')
    .replace(/date- and character-gated/g, 'Context- and character-gated')
    .replace(/date-gated references/g, 'Context-gated references')
    .replace(/date-gated/g, 'Context-gated')
    .replace(/date constraint/g, 'Context constraint')
    .replace(/date-aware/g, 'Context-aware');
}

function cleanDeep(value) {
  if (typeof value === 'string') return cleanLegacyTerminology(value);
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, raw]) => [key, cleanDeep(raw)]));
  }
  return value;
}

function cleanStringArray(value, limit = 64) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const out = [];
  const seen = new Set();
  for (const item of raw.flatMap(v => Array.isArray(v) ? v : [v])) {
    if (item && typeof item === 'object') continue;
    const text = cleanString(item, 180);
    const key = text.toLowerCase();
    if (!text || text === '[object Object]' || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueStringArray(...values) {
  return cleanStringArray(values.flatMap(value => Array.isArray(value) ? value : [value]), 128);
}

function omitEmptyObject(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (Array.isArray(raw)) {
      if (raw.length) out[key] = raw;
      continue;
    }
    if (isPlainObject(raw)) {
      const nested = omitEmptyObject(raw);
      if (nested && Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = raw;
  }
  return Object.keys(out).length ? out : null;
}

export function parseIsoDate(value = '') {
  const text = cleanString(value, 80);
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

function parseContextDate(value = '') {
  const text = cleanString(value, 80);
  if (!text) return null;
  if (text === 'pre-canon') {
    return {
      label: 'Pre-canon',
      scope: 'global',
      precision: 'pre_canon',
    };
  }
  const parsed = parseIsoDate(text);
  if (!parsed) return null;
  return {
    sortKey: parsed.sortKey,
    label: parsed.iso,
    precision: 'date_anchor',
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

function shouldSkipFile(root, file) {
  const relative = path.relative(root, file).replace(/\\/g, '/');
  return NON_ENTRY_FILES.has(relative);
}

function sortObjectKeysForContext(contextGate) {
  const ordered = {};
  for (const key of [
    'scope',
    'validFromAnchor',
    'validToAnchor',
    'sortKeyFrom',
    'sortKeyTo',
    'precision',
    'windowKind',
    'label',
    'approximate',
  ]) {
    if (contextGate[key] !== undefined && contextGate[key] !== null && contextGate[key] !== '') ordered[key] = contextGate[key];
  }
  return ordered;
}

export function getEntryDateRange(entry = {}) {
  const date = isPlainObject(entry.date) ? entry.date : {};
  const canonTiming = isPlainObject(entry.canonTiming) ? entry.canonTiming : {};
  const from = cleanString(date.validFrom || entry.validFrom || canonTiming.hardValidFrom || canonTiming.canonExpectedFrom, 80);
  const to = cleanString(date.validTo || entry.validTo || canonTiming.hardValidTo || canonTiming.canonExpectedUntil || from, 80);
  return {
    from,
    to,
    precision: cleanString(date.precision || canonTiming.precision || 'date', 80) || 'date',
    schoolYear: date.schoolYear ?? canonTiming.schoolYear ?? null,
    book: cleanString(date.book || canonTiming.book, 160),
    label: cleanString(date.label || canonTiming.label, 180),
  };
}

function getSpanDays(from, to) {
  return Math.max(1, Math.round((to.epoch - from.epoch) / DAY_MS) + 1);
}

function inferWindowKind(range = {}, spanDays = 0) {
  if (range.precision === 'school_year' || range.schoolYear) return 'school_year';
  if (range.precision === 'era') return 'era';
  if (spanDays >= 2500) return 'series';
  if (spanDays >= 365) return 'wide';
  if (spanDays <= 14) return 'event';
  return 'bounded';
}

function inferContextScope(spanDays = 0) {
  if (spanDays <= 1) return 'anchor';
  return 'window';
}

function inferPrecision(range = {}, spanDays = 0) {
  if (range.precision === 'school_year' || range.schoolYear) return 'school_year_window';
  if (range.precision === 'era') return 'era_window';
  if (spanDays <= 1) return 'date_anchor';
  if (spanDays <= 14) return 'event_window';
  return 'date_window';
}

function buildContextLabel(range = {}, from, to, spanDays = 0) {
  if (range.label) return range.label;
  if (range.book && range.schoolYear) return `${range.book}: Year ${range.schoolYear}`;
  if (range.book) return range.book;
  if (range.schoolYear) return `Year ${range.schoolYear}`;
  return spanDays <= 1 ? from.iso : `${from.iso} to ${to.iso}`;
}

function findNearestAnchors(timeline = {}, from, to) {
  const anchors = Array.isArray(timeline.anchors) ? timeline.anchors : [];
  const ranges = anchors
    .map(anchor => {
      const anchorFrom = parseIsoDate(anchor.dateRange?.from || '');
      const anchorTo = parseIsoDate(anchor.dateRange?.to || anchor.dateRange?.from || '');
      if (!anchorFrom || !anchorTo) return null;
      return { anchor, from: anchorFrom, to: anchorTo };
    })
    .filter(Boolean);
  const starts = ranges
    .filter(item => item.from.sortKey <= from.sortKey)
    .sort((a, b) => b.from.sortKey - a.from.sortKey);
  const ends = ranges
    .filter(item => item.to.sortKey >= to.sortKey)
    .sort((a, b) => a.to.sortKey - b.to.sortKey);
  return {
    validFromAnchor: starts[0]?.anchor?.id || '',
    validToAnchor: ends[0]?.anchor?.id || '',
  };
}

export function buildContextFromDateRange(range = {}, options = {}) {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to || range.from);
  if (!from || !to) return null;
  const orderedFrom = from.sortKey <= to.sortKey ? from : to;
  const orderedTo = from.sortKey <= to.sortKey ? to : from;
  const spanDays = getSpanDays(orderedFrom, orderedTo);
  const anchors = options.timeline ? findNearestAnchors(options.timeline, orderedFrom, orderedTo) : {};
  return sortObjectKeysForContext({
    scope: inferContextScope(spanDays),
    validFromAnchor: anchors.validFromAnchor,
    validToAnchor: anchors.validToAnchor,
    sortKeyFrom: orderedFrom.sortKey,
    sortKeyTo: orderedTo.sortKey,
    precision: inferPrecision(range, spanDays),
    windowKind: inferWindowKind(range, spanDays),
    label: buildContextLabel(range, orderedFrom, orderedTo, spanDays),
    approximate: range.precision && range.precision !== 'date' && range.precision !== 'school_year',
  });
}

function mergeScope(entry = {}) {
  const raw = isPlainObject(entry.scope) ? entry.scope : {};
  const activeWhen = isPlainObject(entry.activeWhen) ? entry.activeWhen : {};
  const out = {
    ...raw,
    characters: uniqueStringArray(raw.characters, activeWhen.charactersPresentAny, entry.appliesTo),
    locations: uniqueStringArray(raw.locations, activeWhen.locationsAny),
    factions: uniqueStringArray(raw.factions),
    topics: uniqueStringArray(raw.topics, activeWhen.tagsAny),
    objects: uniqueStringArray(raw.objects),
    spells: uniqueStringArray(raw.spells),
    schoolYears: uniqueStringArray(raw.schoolYears),
    books: uniqueStringArray(raw.books),
    eras: uniqueStringArray(raw.eras, activeWhen.erasAny),
  };
  return omitEmptyObject(out) || {};
}

function buildRetrieval(entry = {}, contextGate = {}) {
  const span = Number(contextGate.sortKeyTo) - Number(contextGate.sortKeyFrom) + 1;
  const wide = contextGate.windowKind === 'wide' || contextGate.windowKind === 'series' || (Number.isFinite(span) && span >= 365);
  const narrow = Number.isFinite(span) && span <= 14;
  const scope = mergeScope(entry);
  const triggers = omitEmptyObject({
    charactersAny: scope.characters || [],
    locationsAny: scope.locations || [],
    topicsAny: uniqueStringArray(scope.topics, scope.objects, scope.spells, entry.tags),
    erasAny: scope.eras || [],
  });
  return omitEmptyObject({
    activation: wide ? 'topic_or_entity' : 'context_or_topic',
    frequency: wide ? 'low' : narrow ? 'high' : 'normal',
    contextBoost: wide ? 'low' : narrow ? 'high' : 'medium',
    triggers,
  }) || {};
}

function normalizeVisibilityMapToContext(value = {}) {
  const map = isPlainObject(value) ? value : {};
  const out = {};
  const plain = [];
  const never = [];
  for (const [name, rawContext] of Object.entries(map)) {
    const subject = cleanString(name, 120);
    if (!subject) continue;
    const text = cleanString(rawContext, 80);
    if (text === '9999-12-31') {
      never.push(subject);
      continue;
    }
    const point = parseContextDate(text);
    if (point) out[subject] = point;
    plain.push(subject);
  }
  return {
    subjects: plain,
    positions: out,
    never,
  };
}

function mergeVisibility(entry = {}) {
  const raw = isPlainObject(entry.visibility) ? entry.visibility : {};
  const known = normalizeVisibilityMapToContext(raw.knownBy ?? entry.whoKnowsTruth);
  const notKnown = normalizeVisibilityMapToContext(raw.notKnownByBefore);
  const existingKnownByAtContext = isPlainObject(raw.knownByAtContext) ? raw.knownByAtContext : {};
  const existingNotKnownByBeforeContext = isPlainObject(raw.notKnownByBeforeContext) ? raw.notKnownByBeforeContext : {};
  const rawKnownBySubjects = isPlainObject(raw.knownBy) ? Object.keys(raw.knownBy) : raw.knownBy;
  const out = {
    revealPolicy: entry.revealPolicy || raw.revealPolicy,
    knownBy: uniqueStringArray(known.subjects, rawKnownBySubjects, Object.keys(existingKnownByAtContext)),
    knownByAtContext: { ...existingKnownByAtContext, ...known.positions },
    notKnownByBeforeContext: { ...existingNotKnownByBeforeContext, ...notKnown.positions },
    neverKnownBy: uniqueStringArray(raw.neverKnownBy, notKnown.never),
    suspectedBy: raw.suspectedBy,
    believedBy: raw.believedBy ?? entry.whoBelievesPublicVersion,
    publicFromContext: raw.publicFromContext || parseContextDate(raw.publicFrom),
    secretUntilContext: raw.secretUntilContext || parseContextDate(raw.secretUntil),
  };
  return omitEmptyObject(out) || {};
}

function buildContent(entry = {}) {
  const raw = isPlainObject(entry.content) ? entry.content : {};
  const notes = cleanLegacyTerminology(cleanString(raw.notes || entry.notes, 2000));
  return omitEmptyObject({
    ...raw,
    fact: raw.fact || entry.fact || entry.description || entry.detail || entry.text || entry.summary || '',
    injection: raw.injection || entry.injection || raw.fact || entry.fact || '',
    publicVersion: raw.publicVersion || entry.publicVersion || '',
    notes,
  }) || {};
}

function buildEffects(entry = {}) {
  const raw = isPlainObject(entry.effects) ? entry.effects : {};
  const out = {
    ...raw,
  };
  delete out.blocksTermsBeforeDate;
  return omitEmptyObject(out) || {};
}

function buildSourceInfo(entry = {}) {
  if (isPlainObject(entry.sourceInfo)) return omitEmptyObject(entry.sourceInfo) || {};
  if (isPlainObject(entry.source)) return omitEmptyObject(entry.source) || {};
  return {};
}

function copyKnownFields(entry = {}, context = {}) {
  const out = {};
  const assign = (key, value, includeEmpty = false) => {
    if (value === undefined || value === null) return;
    if (!includeEmpty && value === '') return;
    if (!includeEmpty && Array.isArray(value) && !value.length) return;
    if (!includeEmpty && isPlainObject(value) && !Object.keys(value).length) return;
    out[key] = value;
  };

  assign('schemaVersion', ENTRY_SCHEMA_VERSION, true);
  assign('id', entry.id);
  assign('title', entry.title || entry.name || entry.id);
  assign('kind', entry.kind || entry.gateType || 'fact');
  assign('gateType', entry.gateType || entry.kind || 'fact');
  assign('category', entry.category || 'other');
  assign('relevance', entry.relevance || 'normal');
  assign('lorePurpose', entry.lorePurpose || entry.purpose);
  assign('specificityScore', Number.isFinite(Number(entry.specificityScore)) ? Number(entry.specificityScore) : undefined);
  assign('injectableByDefault', entry.injectableByDefault === undefined ? true : entry.injectableByDefault, true);
  assign('canon', entry.canon || entry.canonStatus || 'canon');
  assign('canonStatus', entry.canon || entry.canonStatus || 'canon');
  assign('truthStatus', entry.truthStatus || 'true');
  assign('revealPolicy', entry.revealPolicy || 'private');
  assign('tags', cleanStringArray(entry.tags, 24));
  assign('priority', Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : 50, true);
  assign('status', entry.status || 'active');
  assign('protected', entry.protected === true, true);
  assign('locked', entry.locked === true, true);
  assign('userEditable', entry.userEditable !== false, true);
  assign('context', context);
  assign('coordinates', Array.isArray(entry.coordinates) ? entry.coordinates : []);
  assign('activation', omitEmptyObject(entry.activation || {}));
  assign('expiration', omitEmptyObject(entry.expiration || {}));
  assign('scope', mergeScope(entry));
  assign('visibility', mergeVisibility(entry));
  assign('retrieval', buildRetrieval(entry, context));
  assign('content', buildContent(entry));
  assign('effects', buildEffects(entry));
  assign('sourceInfo', buildSourceInfo(entry));
  assign('ui', omitEmptyObject(entry.ui || {}));
  assign('extensions', omitEmptyObject(entry.extensions || {}));
  return cleanDeep(out);
}

export function migrateEntryToContext(entry = {}, options = {}) {
  if (isPlainObject(entry.context) && Object.keys(entry.context).length) {
    return {
      entry: copyKnownFields(entry, entry.context),
      changed: true,
      status: 'position_native_existing',
    };
  }
  const range = getEntryDateRange(entry);
  const contextGate = buildContextFromDateRange(range, { timeline: options.timeline });
  if (!contextGate) {
    return { entry, changed: false, status: range.from || range.to ? 'invalid_date' : 'no_date' };
  }
  return {
    entry: copyKnownFields(entry, contextGate),
    changed: true,
    status: 'position_native',
  };
}

function getEntryFiles(root) {
  return listJsonFiles(root).filter(file => !shouldSkipFile(root, file));
}

function normalizeTimeline(root, options = {}) {
  const timelineFile = path.join(root, 'timeline.json');
  if (!fs.existsSync(timelineFile)) return { changed: false, anchorCount: 0, windowCount: 0 };
  const timeline = readJson(timelineFile);
  const anchors = Array.isArray(timeline.anchors) ? timeline.anchors : [];
  const byId = new Map();
  let changed = false;
  const nextAnchors = anchors.map(anchor => {
    const from = parseIsoDate(anchor.dateRange?.from || '');
    const to = parseIsoDate(anchor.dateRange?.to || anchor.dateRange?.from || '');
    if (!from) return anchor;
    const next = {
      ...anchor,
      sortKey: from.sortKey,
    };
    byId.set(anchor.id, { from, to: to || from });
    if (Number(anchor.sortKey) !== Number(next.sortKey)) changed = true;
    return next;
  });

  const windows = Array.isArray(timeline.windows) ? timeline.windows : [];
  const nextWindows = windows.map(window => {
    const from = byId.get(window.anchorFrom)?.from || null;
    const to = byId.get(window.anchorTo)?.to || null;
    const next = {
      ...window,
      ...(from ? { sortKeyFrom: from.sortKey } : {}),
      ...(to ? { sortKeyTo: to.sortKey } : {}),
    };
    if (Number(window.sortKeyFrom) !== Number(next.sortKeyFrom) || Number(window.sortKeyTo) !== Number(next.sortKeyTo)) changed = true;
    return next;
  });

  const nextTimeline = {
    ...timeline,
    sortKeyScale: 'date-derived-day',
    anchors: nextAnchors,
    windows: nextWindows,
  };
  if (timeline.sortKeyScale !== nextTimeline.sortKeyScale) changed = true;
  if (changed && options.write) {
    fs.writeFileSync(timelineFile, `${JSON.stringify(nextTimeline, null, 2)}\n`);
  }
  return { changed, anchorCount: nextAnchors.length, windowCount: nextWindows.length, timeline: nextTimeline };
}

function updateManifest(root, entryFiles, options = {}) {
  const manifestFile = path.join(root, 'loredeck.json');
  if (!fs.existsSync(manifestFile)) return { changed: false };
  const manifest = readJson(manifestFile);
  const relativeEntryFiles = entryFiles
    .map(file => path.relative(root, file).replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b));
  const categoryCounts = {};
  let entryCount = 0;
  for (const file of entryFiles) {
    const json = readJson(file);
    for (const entry of json.entries || []) {
      entryCount += 1;
      const category = cleanString(entry.category || 'other', 80) || 'other';
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  }
  const next = {
    ...manifest,
    entrySchemaVersion: ENTRY_SCHEMA_VERSION,
    description: String(manifest.description || '').replace('date', 'Context'),
    files: relativeEntryFiles,
    compatibility: {
      ...(manifest.compatibility || {}),
      sagaSchemaMin: 3,
      sagaSchemaMax: 3,
    },
    stats: {
      entryCount,
      categoryCounts: Object.fromEntries(Object.entries(categoryCounts).sort((a, b) => a[0].localeCompare(b[0]))),
    },
  };
  const changed = JSON.stringify(manifest) !== JSON.stringify(next);
  if (changed && options.write) {
    fs.writeFileSync(manifestFile, `${JSON.stringify(next, null, 2)}\n`);
  }
  return { changed, entryCount, categoryCounts, files: relativeEntryFiles };
}

export function migrateLoredeckRoot(root = DEFAULT_ROOT, options = {}) {
  const timelineReport = normalizeTimeline(root, options);
  const timeline = timelineReport.timeline || (fs.existsSync(path.join(root, 'timeline.json')) ? readJson(path.join(root, 'timeline.json')) : {});
  const files = getEntryFiles(root);
  const report = {
    root,
    fileCount: 0,
    entryCount: 0,
    changedEntryCount: 0,
    invalidDateCount: 0,
    noDateCount: 0,
    changedFiles: [],
    timelineChanged: timelineReport.changed,
    manifestChanged: false,
    manifestEntryCount: 0,
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
      const result = migrateEntryToContext(entry, { ...options, timeline });
      if (result.status === 'invalid_date') report.invalidDateCount += 1;
      if (result.status === 'no_date') report.noDateCount += 1;
      if (result.changed) {
        fileChanged = true;
        report.changedEntryCount += 1;
      }
      return result.entry;
    });
    const nextJson = {
      ...json,
      schemaVersion: ENTRY_SCHEMA_VERSION,
      entries: nextEntries,
    };
    if (fileChanged || json.schemaVersion !== ENTRY_SCHEMA_VERSION) {
      const relative = path.relative(root, file);
      report.changedFiles.push(relative);
      if (options.write) {
        fs.writeFileSync(file, `${JSON.stringify(nextJson, null, 2)}\n`);
      }
    }
  }

  const manifestReport = updateManifest(root, files, options);
  report.manifestChanged = manifestReport.changed;
  report.manifestEntryCount = manifestReport.entryCount || 0;

  return report;
}

function parseArgs(argv = []) {
  const args = new Set(argv);
  const rootIndex = argv.findIndex(arg => arg === '--root');
  return {
    root: rootIndex >= 0 ? argv[rootIndex + 1] || DEFAULT_ROOT : DEFAULT_ROOT,
    write: args.has('--write'),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = migrateLoredeckRoot(options.root, options);
  console.log(JSON.stringify({
    ...report,
    mode: options.write ? 'write' : 'dry-run',
    note: options.write
      ? 'HP Loredeck entries were rewritten to Context-native schema v3. Legacy entry date gates were removed.'
      : 'Dry run only. Pass --write to rewrite HP Loredeck entries to Context-native schema v3.',
  }, null, 2));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
