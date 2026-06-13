import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function collectSourceFiles(dir = 'src') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(path));
      continue;
    }
    if (/\.(?:js|mjs)$/i.test(entry)) out.push(path);
  }
  return out.sort();
}

const editorActions = readFileSync('src/runtime/loredeck-editor-actions.js', 'utf8');
const runtimePanel = readFileSync('src/runtime/lore-panel.js', 'utf8');
const healthPanel = readFileSync('src/loredecks/loredeck-health-panel.js', 'utf8');
const manifestPreview = readFileSync('src/runtime/loredeck-manifest-preview.js', 'utf8');

assert.ok(editorActions.includes('export async function attemptLoredeckHealthFixes'), 'Editor actions should expose Attempt Fixing as the shared repair command.');
assert.ok(editorActions.includes('attemptLoredeckHealthFixes as attemptLoredeckHealthFixesStorage'), 'Editor Attempt Fixing should call the storage-backed repair implementation through an alias.');
assert.ok(editorActions.includes('attemptResult = await attemptLoredeckHealthFixesStorage(source.packId,'), 'Editor Attempt Fixing should repair by packId through external storage.');
assert.equal(editorActions.includes('repairLoredeckSafeHealthIssues'), false, 'Legacy safe-repair command name should not remain in editor actions.');
assert.equal(editorActions.includes('repairLoredeckSafeHealthIssuesLegacy'), false, 'Settings-backed safe-repair fallback should be removed.');
assert.equal(editorActions.includes('shouldFallbackToLegacySafeRepair'), false, 'Attempt Fixing should not fall back to legacy settings repair.');
assert.equal(editorActions.includes('repairSchemaV3EntryForPack'), false, 'Editor actions should not run the old in-memory schema repair path.');

assert.ok(runtimePanel.includes('attemptLoredeckHealthFixes,'), 'Runtime panel should pass Attempt Fixing directly to child panels.');
assert.equal(runtimePanel.includes('repairLoredeckSafeHealthIssues'), false, 'Runtime panel should not pass the legacy repair dependency.');
assert.equal(runtimePanel.includes('handleLoredeckAssistantHealthRepairDraft'), false, 'Pack Health assistant repair drafting should not remain in runtime panel.');
assert.equal(runtimePanel.includes('LOREDECK_ASSISTANT_HEALTH_REPAIR'), false, 'Runtime panel should not keep legacy assistant health repair batching code.');

assert.ok(healthPanel.includes("createButton('Attempt Fixing'"), 'Health Panel should expose Attempt Fixing.');
assert.ok(healthPanel.includes("createButton(issueState?.status === 'ignored' ? 'Clear Accept As-Is' : 'Accept As-Is'"), 'Health Panel should expose the clarified Accept As-Is action.');
assert.ok(healthPanel.includes("createButton(issueState?.status === 'resolved' ? 'Clear Verification' : 'Verify Fixed'"), 'Health Panel should expose the clarified Verify Fixed action.');
assert.equal(healthPanel.includes('Draft With Assistant'), false, 'Health Panel issue actions should not expose Draft With Assistant.');
assert.equal(healthPanel.includes('handleLoredeckAssistantHealthRepairDraft'), false, 'Health Panel should not depend on the removed assistant repair drafter.');

assert.equal(manifestPreview.includes('createLoredeckHealthRepairPlanner'), false, 'Manifest Preview should not render the removed assistant repair planner.');

const bannedSourceTerms = [
  'repairLoredeckSafeHealthIssues',
  'Draft Repair Batches',
  'Auto-Repair Safe Findings',
  'Repair Safe Issues',
  'Draft With Assistant',
  'safe_repair',
  'loredeck_assistant_repair',
  'selectedHealthIssues',
  'Assistant Draft Fallback',
  'handleLoredeckAssistantHealthRepairDraft',
  'createLoredeckHealthRepairPlanner',
  'loredeckHealthRepairSelectionCache',
  'LOREDECK_ASSISTANT_HEALTH_REPAIR',
  'getLoredeckHealthIssueGroups(',
];
const sourceHits = [];
for (const path of collectSourceFiles()) {
  const text = readFileSync(path, 'utf8');
  for (const term of bannedSourceTerms) {
    if (text.includes(term)) sourceHits.push(`${path}: ${term}`);
  }
}
assert.deepEqual(sourceHits, [], 'Removed Pack Health repair labels and assistant repair entrypoints should not reappear in source files.');

console.log('Loredeck health legacy cleanup tests passed.');
