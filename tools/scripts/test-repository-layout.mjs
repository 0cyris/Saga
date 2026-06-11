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
  'src/extension/index.js',
  'src/extension/settings.html',
  'src/runtime/lore-panel.js',
  'styles/saga.css',
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

const extensionIndex = await readText('src/extension/index.js');
assert.match(extensionIndex, /SETTINGS_TEMPLATE_ID\s*=\s*'src\/extension\/settings'/, 'Extension entrypoint should request the nested settings template.');
assert.match(extensionIndex, /renderExtensionTemplateAsync\(\s*folder,\s*SETTINGS_TEMPLATE_ID/s, 'Extension entrypoint should render settings through the nested template ID.');

const runtimeTheme = await readText('src/theme/runtime-theme.js');
assert.match(runtimeTheme, /EXTENSION_ROOT_ASSET_PATTERN\s*=\s*\/\^\(\?:\\\.\\\/\)\?\(\?:assets\|content\)\\\//, 'Runtime asset resolver should treat ./assets, assets, ./content, and content paths as extension-root assets.');
assert.match(runtimeTheme, /EXTENSION_ROOT_ASSET_PATTERN\.test\(assetPath\)/, 'Runtime asset resolver should use the extension-root asset pattern before module-relative URL resolution.');
assert.match(runtimeTheme, /assetPath\.replace\(\s*\/\^\\\.\\\/\//, 'Runtime asset resolver should strip only the optional ./ prefix before root asset URL resolution.');

const settingsUi = await readText('src/ui/ui.js');
assert.match(settingsUi, /EXTENSION_ROOT_ASSET_PATTERN\s*=\s*\/\^\(\?:\\\.\\\/\)\?\(\?:content\|assets\)\\\//, 'Settings asset resolver should treat ./assets, assets, ./content, and content paths as extension-root assets.');
assert.match(settingsUi, /EXTENSION_ROOT_ASSET_PATTERN\.test\(assetPath\)/, 'Settings asset resolver should use the extension-root asset pattern before module-relative URL resolution.');
assert.doesNotMatch(settingsUi, /LEGACY_PROVIDER_PRESET_NAMES|Provider-1\.0|Provider-1\.1|legacyName/, 'Settings provider install status should not keep pre-alpha Provider-1.0/1.1 compatibility checks.');

const constants = await readText('src/state/constants.js');
assert.doesNotMatch(constants, /LEGACY_EXTENSION_FOLDERS|SagaContinuity/, 'Extension folder detection should not keep pre-alpha legacy install-folder compatibility.');
assert.match(constants, /third-party\\\/\(\[\^\/\]\+\)\\\//, 'Extension folder detection should support nested manifest script paths.');

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

const runtimePanel = await readText('src/runtime/lore-panel.js');
assert.match(runtimePanel, /'loredecks\/index\.json'/, 'Package exporter should write loredecks/index.json.');

console.log('Repository layout contract passed.');
