/**
 * loredeck-library-service.js -- Saga
 * Pure mutation helpers for Loredeck Library folders and deck placements.
 */

import {
  createFolderIdFromPath,
  getFolderPath,
} from './loredeck-library-index.js';

function cloneRecord(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function sortByOrderThenTitle(a = {}, b = {}) {
  return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
    || String(a.title || a.deckId || a.id).localeCompare(String(b.title || b.deckId || b.id));
}

function getDeckId(value = {}) {
  return String(value.deckId || value.packId || value.id || '').trim();
}

function getRegistryPlacements(registry = {}) {
  return Array.isArray(registry.deckPlacements)
    ? registry.deckPlacements.map(item => ({ ...item }))
    : [];
}

function getPlacementMap(placements = []) {
  const byId = new Map();
  for (const placement of placements) {
    const deckId = getDeckId(placement);
    if (deckId) byId.set(deckId, { ...placement, deckId });
  }
  return byId;
}

function buildRegistryWith(registry = {}, patch = {}) {
  return {
    ...(registry && typeof registry === 'object' && !Array.isArray(registry) ? registry : { schemaVersion: 1, packs: {} }),
    ...patch,
  };
}

export function cleanLoredeckLibraryFolderTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function getLoredeckLibraryFolderSiblingRecords(parentId = '', folders = []) {
  const id = String(parentId || '').trim();
  return (folders || [])
    .filter(folder => String(folder.parentId || '').trim() === id)
    .sort(sortByOrderThenTitle);
}

export function hasLoredeckLibraryFolderSiblingTitle(parentId = '', title = '', folders = [], excludeId = '') {
  const normalized = cleanLoredeckLibraryFolderTitle(title).toLowerCase();
  const ignored = String(excludeId || '').trim();
  return getLoredeckLibraryFolderSiblingRecords(parentId, folders)
    .some(folder => folder.id !== ignored && cleanLoredeckLibraryFolderTitle(folder.title).toLowerCase() === normalized);
}

export function createUniqueLoredeckLibraryFolderId(parentId = '', title = '', folders = []) {
  const parentPath = parentId ? getFolderPath(parentId, { folders }) : [];
  const base = createFolderIdFromPath([...parentPath, title]) || createFolderIdFromPath([title]);
  const existing = new Set((folders || []).map(folder => folder.id));
  if (!existing.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}__${index}`.slice(0, 180);
    if (!existing.has(candidate)) return candidate;
  }
  return `${base || 'folder'}__${Date.now()}`.slice(0, 180);
}

export function isLoredeckLibraryFolderDescendant(folderId = '', ancestorId = '', libraryIndex = {}) {
  const target = String(folderId || '').trim();
  const ancestor = String(ancestorId || '').trim();
  if (!target || !ancestor) return false;
  if (target === ancestor) return true;
  const byId = new Map((libraryIndex.folders || []).map(folder => [folder.id, folder]));
  const seen = new Set();
  let current = byId.get(target);
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === ancestor) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

export function getLoredeckLibraryFolderDeckIds(folderId = '', libraryIndex = {}, options = {}) {
  const id = String(folderId || '').trim();
  if (!id) return [];
  const includeNested = options.includeNested !== false;
  const ids = [];
  for (const placement of libraryIndex.deckPlacements || []) {
    const placementFolderId = String(placement.folderId || '').trim();
    if (!placementFolderId) continue;
    const matches = includeNested
      ? isLoredeckLibraryFolderDescendant(placementFolderId, id, libraryIndex)
      : placementFolderId === id;
    if (matches && placement.deckId) ids.push(placement.deckId);
  }
  return [...new Set(ids)];
}

export function reorderLoredeckLibraryPlacements({ packId = '', targetIndex = 0, visiblePacks = [], registry = {} } = {}) {
  const id = String(packId || '').trim();
  const visibleIds = (visiblePacks || []).map(pack => pack.packId).filter(Boolean);
  const currentIndex = visibleIds.indexOf(id);
  const nextIndex = Math.max(0, Math.min(visibleIds.length - 1, Number(targetIndex)));
  if (!id || currentIndex < 0 || !Number.isFinite(nextIndex) || currentIndex === nextIndex) {
    return { ok: false, error: '' };
  }

  const ordered = [...visibleIds];
  const [moved] = ordered.splice(currentIndex, 1);
  ordered.splice(nextIndex, 0, moved);

  const byId = getPlacementMap(getRegistryPlacements(registry));
  const now = Date.now();
  ordered.forEach((deckId, index) => {
    const existing = byId.get(deckId) || { deckId, folderId: '' };
    byId.set(deckId, {
      ...existing,
      deckId,
      sortOrder: (index + 1) * 100,
      updatedAt: now,
    });
  });

  const deckPlacements = [...byId.values()];
  return {
    ok: true,
    deckPlacements,
    registry: buildRegistryWith(registry, { deckPlacements }),
  };
}

export function moveLoredecksToLibraryFolderPlacement({ packIds = [], folderId = '', library = [], libraryIndex = {}, registry = {} } = {}) {
  const ids = Array.from(new Set((packIds || []).map(id => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return { ok: false, error: '' };

  const libraryById = new Map((library || []).map(pack => [pack.packId, pack]));
  const validIds = ids.filter(id => libraryById.has(id));
  if (!validIds.length) {
    return { ok: false, error: 'No selected Loredecks are available in the Library.' };
  }

  const rawFolderId = String(folderId || '').trim();
  const targetFolderId = rawFolderId === 'unfiled' ? '' : rawFolderId;
  if (targetFolderId && !(libraryIndex.folders || []).some(folder => folder.id === targetFolderId)) {
    return { ok: false, error: 'That Library folder is no longer available.' };
  }

  const byId = getPlacementMap(getRegistryPlacements(registry));
  const moving = new Set(validIds);
  let maxSortOrder = 0;
  for (const placement of libraryIndex.deckPlacements || []) {
    const deckId = getDeckId(placement);
    if (moving.has(deckId)) continue;
    if (String(placement.folderId || '').trim() === targetFolderId) {
      maxSortOrder = Math.max(maxSortOrder, Number(placement.sortOrder) || 0);
    }
  }

  let nextSortOrder = Math.max(100, Math.ceil(maxSortOrder / 100) * 100 + 100);
  const now = Date.now();
  for (const deckId of validIds) {
    const existing = byId.get(deckId) || { deckId };
    byId.set(deckId, {
      ...existing,
      deckId,
      folderId: targetFolderId,
      sortOrder: nextSortOrder,
      updatedAt: now,
    });
    nextSortOrder += 100;
  }

  const deckPlacements = [...byId.values()];
  return {
    ok: true,
    validIds,
    targetFolderId,
    deckPlacements,
    registry: buildRegistryWith(registry, { deckPlacements }),
  };
}

export function createLoredeckLibraryFolderRecord(parentId = '', title = '', libraryIndex = {}) {
  const cleanTitle = cleanLoredeckLibraryFolderTitle(title);
  if (!cleanTitle) return { ok: false, error: 'Folder name is required.' };

  const targetParentId = String(parentId || '').trim();
  const folders = (libraryIndex.folders || []).map(folder => ({ ...folder }));
  if (targetParentId && !folders.some(folder => folder.id === targetParentId)) {
    return { ok: false, error: 'Parent folder is no longer available.' };
  }
  if (hasLoredeckLibraryFolderSiblingTitle(targetParentId, cleanTitle, folders)) {
    return { ok: false, error: 'A sibling folder already uses that name.' };
  }

  const siblings = getLoredeckLibraryFolderSiblingRecords(targetParentId, folders);
  const now = Date.now();
  const folder = {
    id: createUniqueLoredeckLibraryFolderId(targetParentId, cleanTitle, folders),
    parentId: targetParentId,
    title: cleanTitle,
    sortOrder: Math.max(0, ...siblings.map(item => Number(item.sortOrder) || 0)) + 100,
    icon: '',
    color: '',
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  };
  return {
    ok: true,
    folder,
    folders: [...folders, folder],
  };
}

export function renameLoredeckLibraryFolderRecord(folderId = '', title = '', libraryIndex = {}) {
  const id = String(folderId || '').trim();
  const cleanTitle = cleanLoredeckLibraryFolderTitle(title);
  if (!id || id === 'unfiled' || !cleanTitle) {
    return { ok: false, error: 'Folder name is required.' };
  }

  const folders = (libraryIndex.folders || []).map(folder => ({ ...folder }));
  const folder = folders.find(item => item.id === id);
  if (!folder) return { ok: false, error: 'That Library folder is no longer available.' };

  const parentId = String(folder.parentId || '').trim();
  if (hasLoredeckLibraryFolderSiblingTitle(parentId, cleanTitle, folders, id)) {
    return { ok: false, error: 'A sibling folder already uses that name.' };
  }
  if (folder.title === cleanTitle) return { ok: false, error: '' };

  folder.title = cleanTitle;
  folder.updatedAt = Date.now();
  return {
    ok: true,
    folder,
    folders,
  };
}

export function getLoredeckLibraryFolderRemovalPlan(folderId = '', libraryIndex = {}) {
  const id = String(folderId || '').trim();
  const folders = (libraryIndex.folders || []).map(folder => ({ ...folder }));
  const folder = folders.find(item => item.id === id) || null;
  const directChildFolders = folders
    .filter(item => String(item.parentId || '').trim() === id)
    .sort(sortByOrderThenTitle);
  const descendantFolders = folders
    .filter(item => item.id !== id && isLoredeckLibraryFolderDescendant(item.id, id, libraryIndex))
    .sort(sortByOrderThenTitle);
  const directDeckIds = [];
  for (const placement of libraryIndex.deckPlacements || []) {
    const deckId = getDeckId(placement);
    if (deckId && String(placement.folderId || '').trim() === id) directDeckIds.push(deckId);
  }
  const containedDeckIds = getLoredeckLibraryFolderDeckIds(id, libraryIndex, { includeNested: true });
  return {
    folder,
    folderId: id,
    parentId: String(folder?.parentId || '').trim(),
    directChildFolders,
    descendantFolders,
    directDeckIds,
    containedDeckIds,
  };
}

export function applyLoredeckLibraryFolderRemovalPlan({ folderId = '', strategy = 'empty', libraryIndex = {}, registry = {} } = {}) {
  const id = String(folderId || '').trim();
  if (!id) return { ok: false, error: '' };
  const folder = (libraryIndex.folders || []).find(item => item.id === id);
  if (!folder) return { ok: false, error: 'That Library folder is no longer available.' };

  const freshPlan = getLoredeckLibraryFolderRemovalPlan(id, libraryIndex);
  const parentId = String(freshPlan.parentId || '').trim();
  if (strategy === 'empty' && (freshPlan.directChildFolders.length || freshPlan.containedDeckIds.length)) {
    return {
      ok: false,
      error: 'Folder is not empty. Choose a contents-preserving deletion strategy.',
    };
  }
  const placementById = getPlacementMap(getRegistryPlacements(registry));
  const indexedPlacementById = getPlacementMap(libraryIndex.deckPlacements || []);
  const now = Date.now();
  const updatePlacement = (deckId, targetFolderId, sortOrder = null) => {
    const placementId = String(deckId || '').trim();
    if (!placementId) return;
    const existing = placementById.get(placementId) || indexedPlacementById.get(placementId) || { deckId: placementId };
    placementById.set(placementId, {
      ...existing,
      deckId: placementId,
      folderId: String(targetFolderId || '').trim(),
      sortOrder: Number.isFinite(Number(sortOrder))
        ? Number(sortOrder)
        : (Number.isFinite(Number(existing.sortOrder)) ? Number(existing.sortOrder) : 0),
      updatedAt: now,
    });
  };

  let folders = (libraryIndex.folders || []).map(item => ({ ...item }));
  let removedFolderIds = [id];
  let selectedFolderId = parentId || 'all';
  let selectedDeckIds = [];

  if (strategy === 'move_to_parent') {
    const conflicts = freshPlan.directChildFolders.filter(child => hasLoredeckLibraryFolderSiblingTitle(parentId, child.title, folders, child.id));
    if (conflicts.length) {
      return {
        ok: false,
        error: `Cannot move contents up: ${conflicts[0].title || conflicts[0].id} already exists in the parent folder.`,
      };
    }
    folders = folders.filter(item => item.id !== id);
    const siblingMax = Math.max(0, ...getLoredeckLibraryFolderSiblingRecords(parentId, folders)
      .filter(item => !freshPlan.directChildFolders.some(child => child.id === item.id))
      .map(item => Number(item.sortOrder) || 0));
    let nextFolderOrder = Math.max(100, Math.ceil(siblingMax / 100) * 100 + 100);
    for (const child of freshPlan.directChildFolders) {
      const record = folders.find(item => item.id === child.id);
      if (!record) continue;
      record.parentId = parentId;
      record.sortOrder = nextFolderOrder;
      record.updatedAt = now;
      nextFolderOrder += 100;
    }

    const targetMaxOrder = Math.max(0, ...(libraryIndex.deckPlacements || [])
      .filter(placement => String(placement.folderId || '').trim() === parentId && !freshPlan.directDeckIds.includes(getDeckId(placement)))
      .map(placement => Number(placement.sortOrder) || 0));
    let nextDeckOrder = Math.max(100, Math.ceil(targetMaxOrder / 100) * 100 + 100);
    for (const deckId of freshPlan.containedDeckIds) {
      const current = indexedPlacementById.get(deckId) || {};
      const currentFolderId = String(current.folderId || '').trim();
      if (currentFolderId === id) {
        updatePlacement(deckId, parentId, nextDeckOrder);
        nextDeckOrder += 100;
        selectedDeckIds.push(deckId);
      } else {
        updatePlacement(deckId, currentFolderId, current.sortOrder);
      }
    }
    selectedFolderId = parentId || 'all';
  } else if (strategy === 'move_decks_to_unfiled') {
    removedFolderIds = [id, ...freshPlan.descendantFolders.map(item => item.id)];
    const removedSet = new Set(removedFolderIds);
    folders = folders.filter(item => !removedSet.has(item.id));
    const targetMaxOrder = Math.max(0, ...(libraryIndex.deckPlacements || [])
      .filter(placement => !removedSet.has(String(placement.folderId || '').trim()))
      .filter(placement => !freshPlan.containedDeckIds.includes(getDeckId(placement)))
      .filter(placement => !String(placement.folderId || '').trim())
      .map(placement => Number(placement.sortOrder) || 0));
    let nextDeckOrder = Math.max(100, Math.ceil(targetMaxOrder / 100) * 100 + 100);
    for (const deckId of freshPlan.containedDeckIds) {
      updatePlacement(deckId, '', nextDeckOrder);
      nextDeckOrder += 100;
    }
    selectedFolderId = 'unfiled';
    selectedDeckIds = freshPlan.containedDeckIds;
  } else {
    folders = folders.filter(item => item.id !== id);
  }

  const deckPlacements = [...placementById.values()];
  return {
    ok: true,
    plan: freshPlan,
    folders,
    deckPlacements,
    removedFolderIds,
    selectedFolderId,
    selectedDeckIds,
    registry: buildRegistryWith(registry, { folders, deckPlacements }),
  };
}

export function moveLoredeckLibraryFolderRecord(folderId = '', targetParentId = '', targetIndex = null, libraryIndex = {}) {
  const id = String(folderId || '').trim();
  const parentId = String(targetParentId || '').trim();
  if (!id || id === 'unfiled') return { ok: false, error: '' };

  const folders = (libraryIndex.folders || []).map(folder => ({ ...folder }));
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const moving = byId.get(id);
  if (!moving) return { ok: false, error: 'That Library folder is no longer available.' };
  if (parentId && !byId.has(parentId)) return { ok: false, error: 'Target folder is no longer available.' };
  if (parentId === id || (parentId && isLoredeckLibraryFolderDescendant(parentId, id, libraryIndex))) {
    return { ok: false, error: 'A folder cannot be moved inside itself or its own child folder.' };
  }
  if (hasLoredeckLibraryFolderSiblingTitle(parentId, moving.title, folders, id)) {
    return { ok: false, error: 'A sibling folder already uses that name.' };
  }

  const currentParentId = String(moving.parentId || '').trim();
  const sameParent = currentParentId === parentId;
  const siblings = folders
    .filter(folder => folder.id !== id && String(folder.parentId || '').trim() === parentId)
    .sort(sortByOrderThenTitle);
  const insertIndex = Number.isFinite(Number(targetIndex))
    ? Math.max(0, Math.min(siblings.length, Number(targetIndex)))
    : siblings.length;
  const now = Date.now();
  const orderedSiblings = [...siblings];
  orderedSiblings.splice(insertIndex, 0, {
    ...moving,
    parentId,
    updatedAt: now,
  });
  orderedSiblings.forEach((folder, index) => {
    const record = byId.get(folder.id);
    if (!record) return;
    record.parentId = parentId;
    record.sortOrder = (index + 1) * 100;
    if (folder.id === id || !sameParent) record.updatedAt = now;
  });

  return {
    ok: true,
    folder: cloneRecord(moving),
    folders: [...byId.values()],
    sameParent,
  };
}
