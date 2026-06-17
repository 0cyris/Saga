import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimePanelPath = path.join(root, 'src', 'runtime', 'lore-panel.js');
const workflowCompositionPath = path.join(root, 'src', 'runtime', 'loredeck-workflow-composition.js');

const panel = fs.readFileSync(runtimePanelPath, 'utf8');
const composition = fs.readFileSync(workflowCompositionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  panel.includes("from './loredeck-workflow-composition.js'")
    && panel.includes('configureLoredeckWorkflowComposition({'),
  'Runtime panel must route Loredeck workflow wiring through loredeck-workflow-composition.js.'
);

for (const configurer of [
  'configureLoredeckHealthPanel',
  'configureLoredeckLibraryPanel',
  'configureLoredeckWorkbenchPanel',
  'configureLoredecksTabPanel',
]) {
  assert(
    composition.includes(`${configurer}(`),
    `Loredeck workflow composition is missing ${configurer}.`
  );
  assert(
    !panel.includes(`${configurer}(`),
    `Runtime panel must not directly call ${configurer}.`
  );
}

for (const token of [
  'loredeckPreviewCacheController',
  'hydrateLoredeckPayloadRecord',
  'flushLoredeckPayloadWrites',
  'getGeneratedLoredeckExportReadiness: pack =>',
  'setLoredeckCreatorDraftInputs',
  'setLoredeckCreatorBriefCacheEntry',
]) {
  assert(
    composition.includes(token) || panel.includes(token),
    `Loredeck workflow composition handoff is missing ${token}.`
  );
}

console.log('Loredeck workflow composition ownership checks passed.');
