import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimePanelPath = path.join(root, 'src', 'runtime', 'lore-panel.js');
const contextCompositionPath = path.join(root, 'src', 'runtime', 'context-composition.js');

const panel = fs.readFileSync(runtimePanelPath, 'utf8');
const composition = fs.readFileSync(contextCompositionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  panel.includes("from './context-composition.js'")
    && panel.includes('configureContextComposition({'),
  'Runtime panel must route Context wiring through context-composition.js.'
);

for (const configurer of [
  'configureContextPanel',
  'configureContextWorkbenchPanel',
]) {
  assert(
    composition.includes(`${configurer}(`),
    `Context composition is missing ${configurer}.`
  );
  assert(
    !panel.includes(`${configurer}(`),
    `Runtime panel must not directly call ${configurer}.`
  );
}

for (const token of [
  'appendContextGenerationStatus',
  'resetContextDetectionSettings',
  'resetLoredeckContextFromPanel',
  'resetLoredeckContextFromWorkbench',
  'openLoredeckEditorForQuery',
  'exportContextWorkbenchTimelineRegistry',
]) {
  assert(
    composition.includes(token),
    `Context composition handoff is missing ${token}.`
  );
}

console.log('Context composition ownership checks passed.');
