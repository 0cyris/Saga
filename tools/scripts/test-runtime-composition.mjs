import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimePanelPath = path.join(root, 'src', 'runtime', 'lore-panel.js');
const runtimeCompositionPath = path.join(root, 'src', 'runtime', 'runtime-composition.js');

const panel = fs.readFileSync(runtimePanelPath, 'utf8');
const composition = fs.readFileSync(runtimeCompositionPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

assert(
  panel.includes("from './runtime-composition.js'")
    && panel.includes('configureRuntimeComposition({'),
  'Runtime panel must route common runtime wiring through runtime-composition.js.'
);

for (const configurer of [
  'configureSettingsPanel',
  'configureRuntimeSettingsTab',
  'configureLoreTimelinePanel',
  'configureContinuityPanel',
  'configureInjectionPreviewPanel',
  'configureRuntimeCollapsible',
  'configureRuntimeTabRegistry',
  'configureRuntimeSafetyPanel',
  'configureRuntimeFeatureProgress',
  'configureRuntimeSettingControls',
  'configureRuntimeShellView',
  'configureAdvancedRuntimePanel',
  'configureSessionBasicPanel',
  'configureRuntimeGuidePrep',
  'configureRuntimeTour',
  'configureRuntimeShell',
]) {
  assert(
    composition.includes(`${configurer}(`),
    `Runtime composition is missing ${configurer}.`
  );
  assert(
    !panel.includes(`${configurer}(`),
    `Runtime panel must not directly call ${configurer}.`
  );
}

for (const token of [
  'setLoredeckCreatorBriefCacheEntry',
  'refreshRuntimeThemeSurfaces',
  'scheduleAcceptedLoreLayoutUpdate',
  'updateAcceptedLoreScrollRegionHeight',
  'getGuideSteps: mode =>',
]) {
  assert(
    composition.includes(token) || panel.includes(token),
    `Runtime composition handoff is missing ${token}.`
  );
}

console.log('Runtime composition ownership checks passed.');
