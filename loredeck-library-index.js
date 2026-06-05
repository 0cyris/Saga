/**
 * loredeck-library-index.js -- Saga
 * Folder/index helpers for organizing Loredecks and resolving folder stack groups.
 *
 * This module is intentionally UI-free. It normalizes library folders, one-primary-folder
 * deck placements, and folder stack resolution so the Library UI can stay thin.
 */

const MAX_FOLDER_DEPTH = 12;
const MAX_FOLDERS = 2000;
const MAX_PLACEMENTS = 20000;
const MAX_STACK_ITEMS = 1000;

export const SPECIAL_LIBRARY_VIEW_IDS = Object.freeze([
  'all',
  'bundled',
  'custom',
  'unfiled',
  'recent',
]);

function clonePlainObject(value, maxLength = 200000) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const text = JSON.stringify(value);
    if (!text || text.length > maxLength) return null;
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function cleanString(value, maxLength = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanId(value, maxLength = 160) {
  return String(value || '').trim().replace(/\s+/g, '_').slice(0, maxLength);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function slugSegment(value) {
  return cleanString(value, 80)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'folder';
}

export function createFolderIdFromPath(path = []) {
  const segments = normalizeLibrarySuggestedPath(path);
  if (!segments.length) return '';
  return `folder_${segments.map(slugSegment).join('__')}`.slice(0, 180);
}

export function normalizeLibrarySuggestedPath(value, maxDepth = MAX_FOLDER_DEPTH) {
  const input = Array.isArray(value)
    ? value
    : (typeof value === 'string' ? value.split(/[>/\\]+/) : []);
  const output = [];
  const seenPath = new Set();
  for (const raw of input) {
    const segment = cleanString(raw, 80);
    if (!segment) continue;
    const key = segment.toLowerCase();
    if (seenPath.has(key)) continue;
    seenPath.add(key);
    output.push(segment);
    if (output.length >= maxDepth) break;
  }
  return output;
}

export function normalizePackLibraryMetadata(value = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const suggestedPath = normalizeLibrarySuggestedPath(input.suggestedPath || input.path || []);
  const familyOrder = Number.isFinite(Number(input.familyOrder)) ? Number(input.familyOrder) : null;
  const output = {};
  if (suggestedPath.length) output.suggestedPath = suggestedPath;
  if (familyOrder !== null) output.familyOrder = familyOrder;
  const folderId = cleanId(input.folderId || '', 180);
  if (folderId) output.folderId = folderId;
  const icon = cleanString(input.icon || '', 80);
  if (icon) output.icon = icon;
  const color = cleanString(input.color || '', 80);
  if (color) output.color = color;
  return output;
}

function normalizeFolderRecord(raw = {}, index = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const title = cleanString(raw.title || raw.name || '', 120);
  const explicitId = cleanId(raw.id || raw.folderId || '', 180);
  const suggestedPath = normalizeLibrarySuggestedPath(raw.path || raw.suggestedPath || []);
  const id = explicitId || createFolderIdFromPath(suggestedPath.length ? suggestedPath : [title]);
  if (!id || !title) return null;
  return {
    id,
    parentId: cleanId(raw.parentId || '', 180),
    title,
    sortOrder: cleanNumber(raw.sortOrder, (index + 1) * 100),
    icon: cleanString(raw.icon || '', 80),
    color: cleanString(raw.color || '', 80),
    collapsed: raw.collapsed === true,
    createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : 0,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
  };
}

function normalizeDeckPlacementRecord(raw = {}, index = 0, folderIds = new Set(), packIds = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const deckId = cleanId(raw.deckId || raw.packId || raw.id || '', 180);
  if (!deckId || (packIds && !packIds.has(deckId))) return null;
  const folderId = cleanId(raw.folderId || '', 180);
  return {
    deckId,
    folderId: folderIds.has(folderId) ? folderId : '',
    sortOrder: cleanNumber(raw.sortOrder, (index + 1) * 100),
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
  };
}

function normalizeStackItem(raw = {}, index = 0, folderIds = new Set(), packIds = null) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const hasFolder = !!cleanId(raw.folderId || '', 180);
  const type = raw.type === 'folder' || hasFolder ? 'folder' : 'deck';
  const id = cleanId(raw.id || `stack_item_${index + 1}`, 180);
  const base = {
    id,
    type,
    enabled: raw.enabled !== false,
    sortOrder: cleanNumber(raw.sortOrder, (index + 1) * 100),
    priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : Math.max(1, 100 - index),
    locked: raw.locked === true,
    addedAt: Number.isFinite(Number(raw.addedAt)) ? Number(raw.addedAt) : 0,
  };
  if (type === 'folder') {
    const folderId = cleanId(raw.folderId || '', 180);
    if (!folderIds.has(folderId)) return null;
    return {
      ...base,
      folderId,
      includeNested: raw.includeNested !== false,
      collapsed: raw.collapsed === true,
    };
  }
  const packId = cleanId(raw.packId || raw.deckId || '', 180);
  if (!packId || (packIds && !packIds.has(packId))) return null;
  return {
    ...base,
    packId,
  };
}

function folderHasCycle(folder, folderMap) {
  const seen = new Set([folder.id]);
  let parentId = folder.parentId;
  while (parentId) {
    if (seen.has(parentId)) return true;
    seen.add(parentId);
    const parent = folderMap.get(parentId);
    if (!parent) return false;
    parentId = parent.parentId;
  }
  return false;
}

function sortByOrderThenTitle(a, b) {
  return (cleanNumber(a.sortOrder, 0) - cleanNumber(b.sortOrder, 0))
    || cleanString(a.title || a.deckId || a.id).localeCompare(cleanString(b.title || b.deckId || b.id));
}

function normalizeFolderList(defaults = [], input = []) {
  const folderMap = new Map();
  for (const [index, raw] of [...asArray(defaults), ...asArray(input)].entries()) {
    const folder = normalizeFolderRecord(raw, index);
    if (folder) folderMap.set(folder.id, folder);
    if (folderMap.size >= MAX_FOLDERS) break;
  }
  for (const folder of folderMap.values()) {
    if (!folderMap.has(folder.parentId) || folder.parentId === folder.id || folderHasCycle(folder, folderMap)) {
      folder.parentId = '';
    }
  }
  return [...folderMap.values()].sort(sortByOrderThenTitle);
}

function ensureFolderPath(folderMap, segments = []) {
  let parentId = '';
  for (let index = 0; index < segments.length; index += 1) {
    const path = segments.slice(0, index + 1);
    const id = createFolderIdFromPath(path);
    if (!folderMap.has(id)) {
      folderMap.set(id, {
        id,
        parentId,
        title: segments[index],
        sortOrder: ((folderMap.size + 1) * 100),
        icon: '',
        color: '',
        collapsed: false,
        createdAt: 0,
        updatedAt: 0,
      });
    }
    const folder = folderMap.get(id);
    if (!folder.parentId && parentId) folder.parentId = parentId;
    parentId = id;
  }
  return parentId;
}

function applySuggestedPackPaths(folders, placementMap, packs = {}) {
  const folderMap = new Map(folders.map(folder => [folder.id, { ...folder }]));
  for (const [packId, pack] of Object.entries(packs || {})) {
    if (placementMap.has(packId)) continue;
    const library = normalizePackLibraryMetadata(pack?.library || pack?.manifestData?.library || {});
    const suggestedPath = library.suggestedPath || [];
    if (!suggestedPath.length) continue;
    const folderId = ensureFolderPath(folderMap, suggestedPath);
    placementMap.set(packId, {
      deckId: packId,
      folderId,
      sortOrder: Number.isFinite(Number(library.familyOrder)) ? Number(library.familyOrder) : (placementMap.size + 1) * 100,
      updatedAt: 0,
    });
  }
  return [...folderMap.values()].sort(sortByOrderThenTitle);
}

export function normalizeLoredeckLibraryIndex(value = {}, options = {}) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = options.defaults && typeof options.defaults === 'object' && !Array.isArray(options.defaults) ? options.defaults : {};
  const packs = options.packs && typeof options.packs === 'object' && !Array.isArray(options.packs) ? options.packs : {};
  const packIds = Object.keys(packs).length ? new Set(Object.keys(packs)) : null;

  let folders = normalizeFolderList(defaults.folders, input.folders);
  let folderIds = new Set(folders.map(folder => folder.id));
  const placementMap = new Map();
  const rawPlacements = [...asArray(defaults.deckPlacements), ...asArray(input.deckPlacements)];
  for (const [index, raw] of rawPlacements.entries()) {
    const placement = normalizeDeckPlacementRecord(raw, index, folderIds, packIds);
    if (placement) placementMap.set(placement.deckId, placement);
    if (placementMap.size >= MAX_PLACEMENTS) break;
  }

  folders = applySuggestedPackPaths(folders, placementMap, packs);
  folderIds = new Set(folders.map(folder => folder.id));

  const deckPlacements = [...placementMap.values()]
    .map((placement, index) => normalizeDeckPlacementRecord(placement, index, folderIds, packIds))
    .filter(Boolean)
    .sort(sortByOrderThenTitle);

  const activeStack = [...asArray(defaults.activeStack), ...asArray(input.activeStack)]
    .map((raw, index) => normalizeStackItem(raw, index, folderIds, packIds))
    .filter(Boolean)
    .slice(0, MAX_STACK_ITEMS)
    .sort(sortByOrderThenTitle);

  return {
    schemaVersion: 1,
    folders,
    deckPlacements,
    activeStack,
  };
}

export function getFolderPath(folderId = '', index = {}) {
  const folders = Array.isArray(index?.folders) ? index.folders : [];
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const path = [];
  const seen = new Set();
  let current = byId.get(cleanId(folderId, 180));
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.title);
    current = byId.get(current.parentId);
  }
  return path;
}

export function buildFolderTree(index = {}) {
  const folders = Array.isArray(index?.folders) ? index.folders : [];
  const byParent = new Map();
  for (const folder of folders) {
    const parentId = cleanId(folder.parentId || '', 180);
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push({ ...folder, children: [] });
  }
  for (const group of byParent.values()) group.sort(sortByOrderThenTitle);
  function attach(parentId = '') {
    return (byParent.get(parentId) || []).map(folder => ({
      ...folder,
      children: attach(folder.id),
    }));
  }
  return attach('');
}

function collectFolderDecks(folderId, index, packs, options = {}, visited = new Set()) {
  const id = cleanId(folderId, 180);
  if (!id || visited.has(id)) return [];
  visited.add(id);
  const folders = Array.isArray(index?.folders) ? index.folders : [];
  const placements = Array.isArray(index?.deckPlacements) ? index.deckPlacements : [];
  const children = [];
  for (const placement of placements) {
    if (placement.folderId === id) {
      children.push({
        type: 'deck',
        deckId: placement.deckId,
        sortOrder: placement.sortOrder,
        title: packs?.[placement.deckId]?.title || placement.deckId,
      });
    }
  }
  if (options.includeNested !== false) {
    for (const folder of folders) {
      if (folder.parentId === id) {
        children.push({
          type: 'folder',
          folderId: folder.id,
          sortOrder: folder.sortOrder,
          title: folder.title,
        });
      }
    }
  }
  children.sort(sortByOrderThenTitle);
  const output = [];
  for (const child of children) {
    if (child.type === 'deck') output.push(child.deckId);
    else output.push(...collectFolderDecks(child.folderId, index, packs, options, visited));
  }
  visited.delete(id);
  return output;
}

export function resolveLoredeckStackItems(stack = [], libraryIndex = {}, options = {}) {
  const packs = options.packs && typeof options.packs === 'object' && !Array.isArray(options.packs) ? options.packs : {};
  const packIds = Object.keys(packs).length ? new Set(Object.keys(packs)) : null;
  const folderIds = new Set((libraryIndex.folders || []).map(folder => folder.id));
  const normalizedStack = asArray(stack)
    .map((raw, index) => normalizeStackItem(raw, index, folderIds, null))
    .filter(Boolean)
    .sort(sortByOrderThenTitle);
  const flattened = [];
  const duplicates = [];
  const missing = [];
  const seen = new Map();

  function addDeck(packId, source, stackItem) {
    if (!packId || (packIds && !packIds.has(packId))) {
      missing.push({ packId, source });
      return;
    }
    if (seen.has(packId)) {
      duplicates.push({
        packId,
        keptAt: seen.get(packId),
        suppressedAt: flattened.length,
        source,
      });
      return;
    }
    const item = {
      packId,
      enabled: true,
      priority: stackItem.priority,
      locked: stackItem.locked === true,
      addedAt: stackItem.addedAt,
      stackIndex: flattened.length,
      source,
    };
    seen.set(packId, flattened.length);
    flattened.push(item);
  }

  for (const stackItem of normalizedStack) {
    if (stackItem.enabled === false && options.includeDisabled !== true) continue;
    if (stackItem.type === 'deck') {
      addDeck(stackItem.packId, { type: 'deck', stackItemId: stackItem.id }, stackItem);
      continue;
    }
    const folderDeckIds = collectFolderDecks(stackItem.folderId, libraryIndex, packs, {
      includeNested: stackItem.includeNested,
    });
    if (!folderDeckIds.length) {
      missing.push({ folderId: stackItem.folderId, source: { type: 'folder', stackItemId: stackItem.id } });
      continue;
    }
    for (const packId of folderDeckIds) {
      addDeck(packId, {
        type: 'folder',
        stackItemId: stackItem.id,
        folderId: stackItem.folderId,
        folderPath: getFolderPath(stackItem.folderId, libraryIndex),
      }, stackItem);
    }
  }

  return {
    stack: flattened,
    duplicates,
    missing,
    summary: {
      stackItemCount: normalizedStack.length,
      resolvedDeckCount: flattened.length,
      duplicateCount: duplicates.length,
      missingCount: missing.length,
    },
  };
}

export const __loredeckLibraryIndexTestHooks = Object.freeze({
  clonePlainObject,
  cleanId,
  normalizeFolderRecord,
  normalizeDeckPlacementRecord,
  normalizeStackItem,
  collectFolderDecks,
});
