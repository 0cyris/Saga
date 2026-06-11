/**
 * loredeck-library-view.js -- Saga
 * Pure view-model helpers for Loredeck Library list ordering.
 */

function getPackId(pack = {}) {
  return String(pack.packId || pack.id || '').trim();
}

function getPackTitle(pack = {}) {
  return String(pack.title || pack.name || getPackId(pack) || '').trim();
}

export function compareLoredeckLibraryTitles(a = '', b = '') {
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

export function compareLoredeckLibraryPackTitles(a = {}, b = {}) {
  return compareLoredeckLibraryTitles(getPackTitle(a), getPackTitle(b))
    || compareLoredeckLibraryTitles(getPackId(a), getPackId(b));
}

export function compareLoredeckLibraryFolderTitles(a = {}, b = {}) {
  return compareLoredeckLibraryTitles(a.title || a.name || a.id, b.title || b.name || b.id)
    || compareLoredeckLibraryTitles(a.id, b.id);
}

export function sortLoredeckLibraryFolderTreeByTitle(folders = []) {
  return [...(folders || [])]
    .sort(compareLoredeckLibraryFolderTitles)
    .map(folder => ({
      ...folder,
      children: sortLoredeckLibraryFolderTreeByTitle(folder.children || []),
    }));
}

function getPlacementForPack(pack = {}, registry = {}) {
  const packId = getPackId(pack);
  if (!packId) return null;
  return (Array.isArray(registry.deckPlacements) ? registry.deckPlacements : [])
    .find(item => item?.deckId === packId || item?.packId === packId) || null;
}

function getFallbackTypeSortOrder(pack = {}) {
  const typeOrder = { bundled: 10000, custom: 20000, generated: 20000 };
  const title = getPackTitle(pack).toLowerCase();
  const titleCode = title ? title.charCodeAt(0) : 0;
  return (typeOrder[pack.type] || 90000) + titleCode;
}

export function getLoredeckLibraryManualSortOrder(pack = {}, registry = {}) {
  const placement = getPlacementForPack(pack, registry);
  if (Number.isFinite(Number(placement?.sortOrder))) return Number(placement.sortOrder);
  if (Number.isFinite(Number(pack.library?.familyOrder))) return Number(pack.library.familyOrder);
  return getFallbackTypeSortOrder(pack);
}

export function compareLoredeckLibraryPacks(a = {}, b = {}, options = {}) {
  const sortMode = String(options.sortMode || 'manual').trim() || 'manual';
  if (sortMode === 'manual') {
    const diff = getLoredeckLibraryManualSortOrder(a, options.registry) - getLoredeckLibraryManualSortOrder(b, options.registry);
    if (diff) return diff;
  } else if (sortMode === 'type') {
    const typeOrder = { bundled: 0, custom: 1, generated: 1 };
    const diff = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    if (diff) return diff;
  } else if (sortMode === 'health') {
    const healthOrder = { error: 0, warning: 1, unknown: 2, suggestion: 3, ok: 4 };
    const getHealthTone = typeof options.getHealthTone === 'function' ? options.getHealthTone : (() => 'unknown');
    const diff = (healthOrder[getHealthTone(a)] ?? 5) - (healthOrder[getHealthTone(b)] ?? 5);
    if (diff) return diff;
  } else if (sortMode === 'entries') {
    const getEntryCount = typeof options.getEntryCount === 'function' ? options.getEntryCount : (() => 0);
    const diff = (Number(getEntryCount(b)) || 0) - (Number(getEntryCount(a)) || 0);
    if (diff) return diff;
  } else if (sortMode === 'updated') {
    const diff = (Number(b.updatedAt) || Number(b.installedAt) || 0) - (Number(a.updatedAt) || Number(a.installedAt) || 0);
    if (diff) return diff;
  }
  return compareLoredeckLibraryPackTitles(a, b);
}

export function sortLoredeckLibraryPacks(packs = [], options = {}) {
  return [...(packs || [])].sort((a, b) => compareLoredeckLibraryPacks(a, b, options));
}
