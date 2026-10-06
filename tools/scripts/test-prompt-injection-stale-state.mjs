import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
async function readText(relativePath) {
  return (await readFile(path.join(repoRoot, relativePath), 'utf8')).replace(/\r\n/g, '\n');
}

// Ownership, prompt clearing, disable/re-enable, event disposal and bridge/tool
// lifecycle are exercised by test-extension-resource-reliability.mjs,
// test-chat-operation-reliability.mjs and test-prompt-injection-event-lifecycle-smoke.mjs.
// Runtime teardown is exercised by test-runtime-view-disposal.mjs. Source text
// cannot establish those behaviors; this script retains presentation copy/control checks.
const runtimePanel = await readText('src/runtime/lore-panel.js');
const injectionPanel = await readText('src/runtime/injection-preview-panel.js');
const runtimeInjectionSource = `${runtimePanel}\n${injectionPanel}`;

assert(runtimeInjectionSource.includes('getInjectionEmptyReason'), 'Injection preview must explain empty prompt reasons.');
assert(runtimeInjectionSource.includes('No Loredecks are loaded for Lore injection'), 'Lore preview must explain unloaded Loredeck state.');
assert(runtimeInjectionSource.includes('No Accepted Lorecards are available to inject'), 'Lore preview must explain empty Accepted Lorecards state.');
assert(runtimeInjectionSource.includes('Continuity injection has no scene'), 'Continuity preview must explain empty continuity state.');
assert(runtimeInjectionSource.includes('refreshInjectionPreviewOnly') && runtimeInjectionSource.includes('getInjectionEmptyReason'), 'Refresh-only path must preserve empty-reason text.');
assert(runtimeInjectionSource.includes('function createPromptInjectionStatusRow') && runtimeInjectionSource.includes("row.classList.add('saga-prompt-sync-status')") && runtimeInjectionSource.includes("row?.querySelector('.saga-prompt-sync-status-value')"), 'Injection preview sync actions must refresh the Current sync chip in place.');
assert(runtimeInjectionSource.includes('const info = syncPromptInjection();\n        refreshPromptInjectionStatusUi(info);'), 'Injection preview refresh-only sync must update visible prompt sync status.');
assert(runtimeInjectionSource.includes('function syncPromptInjectionFromCurrentSettings()'), 'Injection preview setting controls must share an immediate prompt-sync helper.');
for (const settingKey of [
  'next.injectContinuity = checked;',
  'next.injectLore = checked;',
  "next[tierSettingKey(tier, 'InjectionEnabled')] = enabled.checked;",
  "next[tierSettingKey(tier, 'InjectionMode')] = mode;",
  'next[settingKey] = Number(select.value);',
  'next[settingKey] = Math.max(min, Math.min(max, parseInt(input.value, 10) || Number(value) || 0));',
  'next.loreInjectionMode = mode;',
  'next.continuityInjectionMode = mode;',
]) {
  const index = runtimeInjectionSource.indexOf(settingKey);
  assert(index >= 0, `Injection preview setting control must exist: ${settingKey}`);
  const body = runtimeInjectionSource.slice(index, index + 360);
  assert(body.includes('saveSettings(next);') && body.includes('syncPromptInjectionFromCurrentSettings();'), `Injection preview setting save must immediately sync prompts: ${settingKey}`);
}

console.log('Prompt injection presentation contract passed.');
