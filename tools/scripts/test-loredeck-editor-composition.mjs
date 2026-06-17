import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimePanelPath = path.join(root, 'src', 'runtime', 'lore-panel.js');
const editorCompositionPath = path.join(root, 'src', 'runtime', 'loredeck-editor-composition.js');

const panel = fs.readFileSync(runtimePanelPath, 'utf8');
const composition = fs.readFileSync(editorCompositionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  panel.includes("from './loredeck-editor-composition.js'")
    && panel.includes('configureLoredeckEditorComposition({'),
  'Runtime panel must route Loredeck editor wiring through loredeck-editor-composition.js.'
);

for (const configurer of [
  'configureLoredeckEditorActions',
  'configureLoredeckEntryOverridesPanel',
  'configureLoredeckTimelineRegistryPanel',
  'configureLoredeckTagManagerPanel',
  'configureLoredeckPendingChangeModel',
  'configureLoredeckReviewHelpers',
  'configureLoredeckPendingChangeActions',
  'configureLoredeckEditProposals',
  'configureLoredeckPendingReviewPanel',
  'configureLoredeckAssistantReviewPanel',
  'configureLoredeckPackageExport',
  'configureLoredeckPackageInstallPanel',
  'configureLoredeckEditorLoader',
  'configureLoredeckEditorValidation',
  'configureLoredeckManifestPreview',
  'configureGeneratedLoredeckExportCard',
  'configureGeneratedLoredeckReadiness',
]) {
  assert(
    composition.includes(`${configurer}(`),
    `Loredeck editor composition is missing ${configurer}.`
  );
  assert(
    !panel.includes(`${configurer}(`),
    `Runtime panel must not directly call ${configurer}.`
  );
}

for (const token of [
  'loredeckPreviewCacheController',
  'loredeckAssistantDraftCacheController',
  'flushLoredeckStorageWrites',
  'normalizeLoredeckPatchEntryOverride',
  'getLoredeckAssistantDraftCacheRecord',
  'getGeneratedLoredeckExportReadiness',
]) {
  assert(
    composition.includes(token) || panel.includes(token),
    `Loredeck editor composition handoff is missing ${token}.`
  );
}

console.log('Loredeck editor composition ownership checks passed.');
