import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert(firstIndex >= 0, `${message}: missing ${first}`);
  assert(secondIndex >= 0, `${message}: missing ${second}`);
  assert(firstIndex < secondIndex, message);
}

const manifest = JSON.parse(await readText('manifest.json'));
const extensionIndex = await readText('src/extension/index.js');
const stateManager = await readText('src/state/state-manager.js');
const runtimePanel = await readText('src/runtime/lore-panel.js');
const visualSmoke = await readText('tools/scripts/test-visual-smoke-harness.mjs');

assert.deepEqual(
  manifest.hooks,
  {
    install: 'sagaOnInstall',
    update: 'sagaOnUpdate',
    delete: 'sagaOnDelete',
    clean: 'sagaOnClean',
    enable: 'sagaOnEnable',
    disable: 'sagaOnDisable',
    activate: 'sagaOnActivate',
  },
  'Manifest must register SillyTavern lifecycle hooks for Saga.'
);

for (const hookName of Object.values(manifest.hooks)) {
  assert(extensionIndex.includes(`export async function ${hookName}`), `${hookName} must be exported from the extension entrypoint.`);
}

assert(extensionIndex.includes('before_extension_update'), 'Update hook must back up current-chat state.');
assert(extensionIndex.includes('before_extension_delete'), 'Delete hook must back up current-chat state.');
assert(extensionIndex.includes('before_extension_clean'), 'Clean hook must back up current-chat state.');
assert(extensionIndex.includes('clearStoredSecret') && extensionIndex.includes('loreOpenAI') && extensionIndex.includes('continuityOpenAI'), 'Clean hook must remove direct provider key material.');
assert(extensionIndex.includes('handleExtensionDisabled()'), 'Disable/delete/clean hooks must clear prompt injection through the shared disable handler.');

assert(stateManager.includes('MIN_SUPPORTED_IMPORT_STATE_SCHEMA_VERSION'), 'State import must declare a minimum supported import schema.');
assert(stateManager.includes('getImportedStateSchemaError'), 'State import must use explicit schema validation.');
assert(stateManager.includes('Unsupported Saga state schema'), 'Old state imports must fail with a clear unsupported-schema error.');
assert(stateManager.includes('Unsupported future Saga state schema'), 'Future state imports must fail with a clear unsupported-schema error.');
assert(stateManager.includes('recordStateSafetyEvent'), 'State manager must expose a State Safety lifecycle log helper.');
assert(stateManager.includes('before_schema_migration'), 'Stored current-chat migrations must create a pre-migration backup.');
assert(stateManager.includes('schema_migration'), 'Stored current-chat migrations must add a visible migration log entry.');
assert(stateManager.includes('state_restore_failed'), 'Failed state restores must be visible in State Safety diagnostics.');
assertBefore(stateManager, "appendStateBackupRecord(current, 'before_file_restore'", 'const imported = importState(json);', 'File restore must create the backup before parsing/importing replacement state.');
assertBefore(stateManager, 'saveState(current, { syncPrompt: false });', 'const imported = importState(json);', 'File restore must persist the backup before parsing/importing replacement state.');

for (const reason of [
  'before_loredeck_package_import',
  'before_creator_finalization',
  'before_accept_loredeck_pending_changes',
  'before_reject_loredeck_pending_changes',
  'before_delete_all_lore',
  'before_generation_reset',
  'before_total_reset',
]) {
  assert(runtimePanel.includes(reason), `Runtime action must create State Safety backup: ${reason}`);
}

assert(runtimePanel.includes('createStateSafetyCard'), 'Runtime settings must expose the State Safety card.');
assert(runtimePanel.includes('Export State'), 'State Safety card must support one-click export.');
assert(runtimePanel.includes('Restore From File'), 'State Safety card must support one-click restore from exported state.');
assert(runtimePanel.includes('Restore Latest Backup'), 'State Safety card must support restoring a saved in-chat backup.');
assert(runtimePanel.includes('Latest migration log'), 'State Safety card must show migration diagnostics.');

assert(visualSmoke.includes('State Safety backup/export/restore card'), 'Visual smoke source contract must guard State Safety UI.');

console.log('State safety contract passed.');
