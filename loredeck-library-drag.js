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
    if (dropKind === 'stack') return { valid: true, action: 'add-stack', text: `Add ${label} to Active Stack` };
    if (dropKind === 'folder') {
      return dropFolderId
        ? { valid: true, action: 'move-folder', text: `Move ${label} to ${folderTitle}` }
        : { valid: false, action: 'invalid', text: 'Choose a folder target' };
    }
    if (dropKind === 'library') {
      return {
        valid: true,
        action: 'reorder-library',
        text: state.targetIndex !== state.originalIndex ? 'Reorder in Library' : 'Keep Library position',
      };
    }
    return { valid: false, action: 'invalid', text: 'Not a valid drop target' };
  }

  if (state.dragType === 'library-folder') {
    const folderTitleText = state.folderTitle || 'Folder';
    if (dropKind === 'stack') return { valid: true, action: 'add-stack-group', text: `Add ${folderTitleText} as Stack Group` };
    if (dropKind === 'folder') {
      if (!dropFolderId) return { valid: false, action: 'invalid', text: 'Choose a folder target' };
      if (dropFolderId === 'unfiled') {
        return { valid: false, action: 'invalid-unfiled', text: 'Folders cannot be placed inside Unfiled' };
      }
      if (dropFolderId === state.folderId) {
        return { valid: false, action: 'invalid-self', text: `Cannot move ${folderTitleText} into itself` };
      }
      if (isLoredeckLibraryFolderDescendant(dropFolderId, state.folderId, libraryIndex)) {
        return { valid: false, action: 'invalid-child', text: `Cannot move ${folderTitleText} into its own child folder` };
      }
      return { valid: true, action: 'move-folder', text: `Move ${folderTitleText} into ${folderTitle}` };
    }
    if (dropKind === 'library') {
      if (state.reparentToRoot) {
        return {
          valid: true,
          action: 'move-root',
          text: `Move ${folderTitleText} to Library root`,
          badge: 'Move to Library root',
          root: true,
        };
      }
      return {
        valid: true,
        action: 'reorder-folder',
        text: state.targetIndex !== state.originalIndex ? `Reorder ${folderTitleText}` : `Keep ${folderTitleText} here`,
      };
    }
    return { valid: false, action: 'invalid', text: 'Not a valid drop target' };
  }

  if (state.dragType === 'stack-item') {
    const isFolderGroup = String(state.stackKey || '').startsWith('folder:');
    if (dropKind === 'stack') {
      return {
        valid: true,
        action: 'reorder-stack',
        text: state.targetIndex !== state.originalIndex ? 'Reorder Active Stack' : 'Keep stack position',
      };
    }
    if (dropKind === 'library') {
      const label = isFolderGroup
        ? 'folder group'
        : getLoredeckLibraryDragCountLabel(state.packIds?.length || 1);
      return {
        valid: true,
        action: 'remove-stack',
        text: `Remove ${label} from Active Stack`,
        badge: 'Remove from Active Stack',
        remove: true,
      };
    }
    if (dropKind === 'folder') {
      if (isFolderGroup) {
        return {
          valid: false,
          action: 'invalid-stack-folder',
          text: 'Stack Groups cannot be filed into Library folders; drag to Library to remove from Stack',
        };
      }
      const label = getLoredeckLibraryDragCountLabel(state.packIds?.length || 1);
      return { valid: true, action: 'move-folder', text: `Move ${label} to ${folderTitle}` };
    }
    return { valid: false, action: 'invalid', text: 'Not a valid drop target' };
  }

  return { valid: true, action: 'drop', text: 'Drop to apply' };
}
