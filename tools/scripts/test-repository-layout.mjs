import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function exists(relativePath) {
  try {
    await stat(path.join(repoRoot, relativePath));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

for (const oldRoot of ['Images', 'Loredecks', 'Presets', 'scripts']) {
  assert.equal(await exists(oldRoot), false, `${oldRoot}/ must not return to the repository root.`);
}

for (const requiredPath of [
  'assets',
  'assets/branding',
  'assets/documentation/renders',
  'content/loredecks',
  'content/loredecks/index.json',
  'content/presets/Provider-1.2.json',
  'src/continuity/continuity-panel.js',
  'src/extension/bootstrap.js',
  'src/extension/events.js',
  'src/extension/global-bridge.js',
  'src/extension/index.js',
  'src/extension/lifecycle.js',
  'src/extension/menu-button.js',
  'src/extension/runtime-mount.js',
  'src/extension/settings.html',
  'src/extension/settings-mount.js',
  'src/extension/slash-commands.js',
  'src/settings/runtime-settings-tab.js',
  'src/loredecks/context-health.js',
  'src/loredecks/loredeck-health-core.js',
  'src/loredecks/loredeck-health-engine.js',
  'src/loredecks/loredeck-normalizer.js',
  'src/loredecks/schema-v3-health.js',
  'src/loredecks/tag-registry-health.js',
  'src/runtime/active-stack-panel.js',
  'src/runtime/advanced-runtime-panel.js',
  'src/runtime/loredeck-generated-export-card.js',
  'src/runtime/loredeck-generated-readiness.js',
  'src/runtime/loredeck-editor-fields.js',
  'src/runtime/loredeck-editor-loader.js',
  'src/runtime/loredeck-editor-validation.js',
  'src/runtime/loredeck-manifest-formatters.js',
  'src/runtime/loredeck-manifest-preview.js',
  'src/runtime/loredeck-manifest-runtime.js',
  'src/runtime/loredeck-package-export.js',
  'src/runtime/loredeck-package-helpers.js',
  'src/runtime/loredeck-package-install.js',
  'src/runtime/loredeck-package-install-panel.js',
  'src/runtime/loredeck-source-summary.js',
  'src/runtime/loredeck-virtual-data.js',
  'src/runtime/lore-panel.js',
  'src/runtime/injection-preview-panel.js',
  'src/runtime/runtime-collapsible.js',
  'src/runtime/runtime-feature-progress.js',
  'src/runtime/runtime-guide-prep.js',
  'src/runtime/runtime-lore-registry.js',
  'src/runtime/runtime-rail-metrics.js',
  'src/runtime/runtime-shell-view.js',
  'src/runtime/runtime-actions.js',
  'src/runtime/runtime-safety-panel.js',
  'src/runtime/runtime-setting-controls.js',
  'src/runtime/runtime-setting-groups.js',
  'src/runtime/session-basic-panel.js',
  'src/runtime/tab-registry.js',
  'src/state/basic-profile.js',
  'src/state/constants.js',
  'src/state/continuity-state.js',
  'src/state/default-settings.js',
  'src/state/default-state.js',
  'src/state/import-export.js',
  'src/state/lore-creator-store.js',
  'src/state/lore-creator-state.js',
  'src/state/lore-generation-state.js',
  'src/state/lore-storage-sanitizer.js',
  'src/state/lore-state-normalizers.js',
  'src/state/loredeck-library-store.js',
  'src/state/prompt-defaults.js',
  'src/state/provider-defaults.js',
  'src/state/prompt-sync.js',
  'src/state/schema.js',
  'src/state/settings-store.js',
  'src/state/state-backup.js',
  'src/state/storage-safety.js',
  'src/state/theme-library-store.js',
  'src/state/ui-defaults.js',
  'src/storage',
  'src/storage/saga-creator-project-storage.js',
  'src/storage/saga-domain-storage.js',
  'src/storage/saga-file-api.js',
  'src/storage/saga-lorepack-library-storage.js',
  'src/storage/saga-lorepack-payload-storage.js',
  'src/storage/saga-storage-diagnostics.js',
  'src/storage/saga-storage-filenames.js',
  'src/storage/saga-storage-index.js',
  'src/storage/saga-theme-icon-storage.js',
  'styles/components.css',
  'styles/continuity.css',
  'styles/layout.css',
  'styles/review.css',
  'styles/runtime.css',
  'styles/saga.css',
  'styles/settings.css',
  'styles/tokens.css',
  'styles/workbench.css',
  'tests/browser/dropdown-latency.html',
  'tests/browser/visual-smoke.html',
  'tools/scripts',
]) {
  assert.equal(await exists(requiredPath), true, `${requiredPath} should exist in the alpha repository layout.`);
}

assert.equal(await exists('tests/visual-smoke.html'), false, 'visual smoke harness must stay under tests/browser/.');
assert.equal(await exists('index.js'), false, 'Root index.js shim should not return now that the SillyTavern manifest points to src/extension/index.js.');
assert.equal(await exists('style.css'), false, 'Root style.css shim should not return now that the SillyTavern manifest points to styles/saga.css.');
assert.equal(await exists('settings.html'), false, 'Root settings.html should not return now that renderExtensionTemplateAsync loads src/extension/settings.html.');

const rootEntries = await readdir(repoRoot, { withFileTypes: true });
const rootTempLogs = rootEntries
  .filter(entry => entry.isFile() && /^tmp-.*\.log$/i.test(entry.name))
  .map(entry => entry.name);
assert.deepEqual(rootTempLogs, [], 'Temporary smoke/runtime logs should not be tracked in the repository root.');

const manifest = JSON.parse(await readText('manifest.json'));
assert.equal(manifest.js, 'src/extension/index.js', 'SillyTavern manifest should point directly at the nested extension entrypoint.');
assert.equal(manifest.css, 'styles/saga.css', 'SillyTavern manifest should point directly at the nested stylesheet.');

const stylesheetEntry = await readText('styles/saga.css');
for (const cssModule of ['components', 'runtime', 'settings', 'tokens', 'continuity', 'review', 'layout', 'workbench']) {
  assert.ok(stylesheetEntry.includes(`@import './${cssModule}.css';`), `styles/saga.css should import ${cssModule}.css in the composed stylesheet.`);
}

const extensionIndex = await readText('src/extension/index.js');
assert.match(extensionIndex, /import \{ bootstrapSagaExtension \} from '\.\/bootstrap\.js'/, 'Extension entrypoint should delegate document-ready startup to the bootstrap module.');
assert.match(extensionIndex, /import \{ configureRuntimeActions \} from '\.\/runtime-mount\.js'/, 'Extension entrypoint should delegate runtime action registration to the runtime mount module.');
assert.match(extensionIndex, /export \{[\s\S]*sagaOnInstall[\s\S]*sagaOnActivate[\s\S]*\} from '\.\/lifecycle\.js'/, 'Extension entrypoint should re-export lifecycle hooks from the lifecycle module.');
assert.match(extensionIndex, /configureRuntimeActions\(\)/, 'Extension entrypoint should register runtime actions before bootstrap.');
assert.match(extensionIndex, /await bootstrapSagaExtension\(\)/, 'Extension entrypoint should run bootstrap from document ready.');

const bootstrap = await readText('src/extension/bootstrap.js');
assert.match(bootstrap, /import \{ mountSettingsPanel \} from '\.\/settings-mount\.js'/, 'Bootstrap module should delegate settings mounting to the settings module.');
assert.match(bootstrap, /await mountSettingsPanel\(ctx\)/, 'Bootstrap module should mount settings through the settings module.');

const settingsMount = await readText('src/extension/settings-mount.js');
assert.match(settingsMount, /SETTINGS_TEMPLATE_ID\s*=\s*'src\/extension\/settings'/, 'Settings mount module should request the nested settings template.');
assert.match(settingsMount, /renderExtensionTemplateAsync\(\s*folder,\s*SETTINGS_TEMPLATE_ID/s, 'Settings mount module should render settings through the nested template ID.');

const runtimeTheme = await readText('src/theme/runtime-theme.js');
assert.match(runtimeTheme, /EXTENSION_ROOT_ASSET_PATTERN\s*=\s*\/\^\(\?:\\\.\\\/\)\?\(\?:assets\|content\)\\\//, 'Runtime asset resolver should treat ./assets, assets, ./content, and content paths as extension-root assets.');
assert.match(runtimeTheme, /EXTENSION_ROOT_ASSET_PATTERN\.test\(assetPath\)/, 'Runtime asset resolver should use the extension-root asset pattern before module-relative URL resolution.');
assert.match(runtimeTheme, /assetPath\.replace\(\s*\/\^\\\.\\\/\//, 'Runtime asset resolver should strip only the optional ./ prefix before root asset URL resolution.');

const settingsUi = await readText('src/ui/ui.js');
assert.match(settingsUi, /EXTENSION_ROOT_ASSET_PATTERN\s*=\s*\/\^\(\?:\\\.\\\/\)\?\(\?:content\|assets\)\\\//, 'Settings asset resolver should treat ./assets, assets, ./content, and content paths as extension-root assets.');
assert.match(settingsUi, /EXTENSION_ROOT_ASSET_PATTERN\.test\(assetPath\)/, 'Settings asset resolver should use the extension-root asset pattern before module-relative URL resolution.');
assert.doesNotMatch(settingsUi, /LEGACY_PROVIDER_PRESET_NAMES|Provider-1\.0|Provider-1\.1|legacyName/, 'Settings provider install status should not keep pre-alpha Provider-1.0/1.1 compatibility checks.');

const constants = await readText('src/state/constants.js');
assert.match(constants, /from '\.\/schema\.js'/, 'Constants facade should re-export schema constants.');
assert.match(constants, /from '\.\/default-settings\.js'/, 'Constants facade should re-export default settings.');
assert.match(constants, /from '\.\/default-state\.js'/, 'Constants facade should re-export default state.');
assert.match(constants, /from '\.\/prompt-defaults\.js'/, 'Constants facade should re-export prompt defaults.');

const uiDefaults = await readText('src/state/ui-defaults.js');
assert.doesNotMatch(uiDefaults, /LEGACY_EXTENSION_FOLDERS|SagaContinuity/, 'Extension folder detection should not keep pre-alpha legacy install-folder compatibility.');
assert.match(uiDefaults, /third-party\\\/\(\[\^\/\]\+\)\\\//, 'Extension folder detection should support nested manifest script paths.');

const loredeckLibraryPanel = await readText('src/loredecks/loredeck-library-panel.js');
assert.doesNotMatch(loredeckLibraryPanel, /(?:Images|Loredecks|Presets)\\\//, 'Runtime library code should not preserve escaped old root folder path checks.');
assert.doesNotMatch(loredeckLibraryPanel, /replace\(\s*\/\^Loredecks\\\//, 'Bundled Loredeck manifest normalization should not strip the old root Loredecks/ path.');

const loredeckLoader = await readText('src/loredecks/loredeck-loader.js');
assert.doesNotMatch(loredeckLoader, /replace\(\s*\/\^Loredecks\\\//, 'Bundled Loredeck loader should not strip the old root Loredecks/ path.');

for (const conformanceScript of [
  'tools/scripts/test-hp-reference-deck-conformance.mjs',
  'tools/scripts/report-jjk-loredeck-coverage.mjs',
  'tools/scripts/test-jjk-canon-review-readiness.mjs',
  'tools/scripts/test-jjk-family-coverage.mjs',
  'tools/scripts/test-jjk-loredeck-suite.mjs',
  'tools/scripts/test-jjk-spoiler-boundaries.mjs',
  'tools/scripts/test-jjk-reference-deck-conformance.mjs',
]) {
  assert.doesNotMatch(await readText(conformanceScript), /replace\(\s*\/\^Loredecks\\\//, `${conformanceScript} should validate current content/loredecks paths without old root normalization.`);
}

const gitignore = await readText('.gitignore');
assert.match(gitignore, /^\.tmp\/$/m, '.gitignore should keep local temp output under .tmp/.');
assert.match(gitignore, /^tmp-\*\.log$/m, '.gitignore should ignore root temp logs from local smoke runs.');
assert.match(gitignore, /^assets\/documentation\/renders\/\*$/m, '.gitignore should keep documentation render output scoped under assets/.');

const packageService = await readText('src/loredecks/loredeck-package-service.js');
assert.match(packageService, /LOREDECK_PACKAGE_ROOT\s*=\s*'loredecks'/, 'Package parser should use lowercase loredecks/ archive root.');
assert.match(packageService, /missing loredecks\/index\.json/, 'Package parser should report the lowercase package index contract.');

const runtimePackageSource = [
  await readText('src/runtime/lore-panel.js'),
  await readText('src/runtime/loredeck-package-export.js'),
  await readText('src/runtime/loredeck-package-install.js'),
].join('\n');
assert.match(runtimePackageSource, /'loredecks\/index\.json'/, 'Package exporter should write loredecks/index.json.');

console.log('Repository layout contract passed.');
