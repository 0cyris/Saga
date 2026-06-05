/**
 * loredeck-library-drag.js -- Saga
 * Pure feedback helpers for Loredeck Library drag/drop interactions.
 */

import { getFolderPath } from './loredeck-library-index.js';
import { isLoredeckLibraryFolderDescendant } from './loredeck-library-service.js';

export function getLoredeckLibraryDropFolderTitle(folderId = '', libraryIndex = {}) {
  const id = String(folderId || '').trim();
  if (id === 'unfiled') return 'Unfiled';
  return getFolderPath(id, libraryIndex).join(' > ')
    || (libraryIndex.folders || []).find(folder => folder.id === id)?.title
    || 'Folder';
}

export function getLoredeckLibraryDragCountLabel(count = 1, singular = 'Loredeck', plural = 'Loredecks') {
  const value = Math.max(1, Number(count) || 1);
  return `${value} ${value === 1 ? singular : plural}`;
}

export function resolveLoredeckLibraryDragFeedback(state = {}) {
  const dropKind = String(state.dropKind || '').trim();
  const dropFolderId = String(state.dropFolderId || '').trim();
  const libraryIndex = state.libraryIndex || {};
  const isFolderTarget = dropKind === 'folder';
  const folderTitle = isFolderTarget ? getLoredeckLibraryDropFolderTitle(dropFolderId, libraryIndex) : '';

  if (state.dragType === 'library-deck') {
    const label = getLoredeckLibraryDragCountLabel(state.packIds?.length || 1);
    if (dropKind === 'stack') return { valid: true, text: `Add ${label} to Active Stack` };
    if (dropKind === 'folder') return { valid: true, text: `Move ${label} to ${folderTitle}` };
    if (dropKind === 'library') {
      return {
        valid: true,
        text: state.targetIndex !== state.originalIndex ? 'Reorder in Library' : 'Keep Library position',
      };
    }
    return { valid: false, text: 'Not a valid drop target' };
  }

  if (state.dragType === 'library-folder') {
    const folderTitleText = state.folderTitle || 'Folder';
    if (dropKind === 'stack') return { valid: true, text: `Add ${folderTitleText} folder to Active Stack` };
    if (dropKind === 'folder') {
      const invalid = !dropFolderId
        || dropFolderId === 'unfiled'
        || dropFolderId === state.folderId
        || isLoredeckLibraryFolderDescendant(dropFolderId, state.folderId, libraryIndex);
      return invalid
        ? { valid: false, text: 'Cannot move a folder into itself, Unfiled, or a child folder' }
        : { valid: true, text: `Move ${folderTitleText} into ${folderTitle}` };
    }
    if (dropKind === 'library') {
      if (state.reparentToRoot) return { valid: true, text: `Move ${folderTitleText} to Library root`, root: true };
      return {
        valid: true,
        text: state.targetIndex !== state.originalIndex ? 'Reorder folder' : 'Keep folder position',
      };
    }
    return { valid: false, text: 'Not a valid drop target' };
  }

  if (state.dragType === 'stack-item') {
    const isFolderGroup = String(state.stackKey || '').startsWith('folder:');
    if (dropKind === 'stack') {
      return {
        valid: true,
        text: state.targetIndex !== state.originalIndex ? 'Reorder Active Stack' : 'Keep stack position',
      };
    }
    if (dropKind === 'library') return { valid: true, text: 'Remove from Active Stack' };
    if (dropKind === 'folder') {
      if (isFolderGroup) return { valid: false, text: 'Folder groups cannot be dropped into Library folders' };
      const label = getLoredeckLibraryDragCountLabel(state.packIds?.length || 1);
      return { valid: true, text: `Move ${label} to ${folderTitle}` };
    }
    return { valid: false, text: 'Not a valid drop target' };
  }

  return { valid: true, text: 'Drop to apply' };
}
