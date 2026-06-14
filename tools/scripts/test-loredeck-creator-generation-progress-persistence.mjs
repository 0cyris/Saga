import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const runtimePanelSource = fs.readFileSync(path.join(root, 'src', 'runtime', 'lore-panel.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist.`);
  const signatureEnd = source.indexOf(') {', start);
  assert.notEqual(signatureEnd, -1, `${name} should have a simple function signature.`);
  const bodyStart = source.indexOf('{', signatureEnd);
  assert.notEqual(bodyStart, -1, `${name} should have a body.`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} body should close.`);
}

const localUpdater = extractFunction(runtimePanelSource, 'updateLoredeckCreatorActiveGenerationLocal');
assert.ok(localUpdater.includes("loredeckCreatorBriefCache.set('current'"), 'Local active-generation updates should refresh the in-memory Creator job.');
assert.equal(localUpdater.includes('upsertLoredeckCreatorJob('), false, 'Local active-generation updates must not persist the Creator project payload.');
assert.equal(localUpdater.includes('setLoredeckCreatorBriefCache('), false, 'Local active-generation updates must not route through the persistent cache helper.');

const ticker = extractFunction(runtimePanelSource, 'startLoredeckCreatorGenerationTicker');
assert.ok(ticker.includes('updateLoredeckCreatorActiveGenerationLocal'), 'The elapsed-time ticker should update local live state only.');
assert.equal(ticker.includes('setLoredeckCreatorBriefCache('), false, 'The elapsed-time ticker must not persist a project write every second.');
assert.equal(ticker.includes('coalesceStorageWrite'), false, 'The elapsed-time ticker should not enqueue storage writes, even coalesced writes.');

const generationUpdater = extractFunction(runtimePanelSource, 'updateLoredeckCreatorGeneration');
assert.ok(generationUpdater.includes('options.persist === false'), 'Generation progress updates should support local-only progress events.');
assert.ok(generationUpdater.includes('updateLoredeckCreatorActiveGenerationLocal'), 'Local-only progress events should use the in-memory live updater.');

const progressHandler = extractFunction(runtimePanelSource, 'makeLoredeckCreatorProgressHandler');
assert.ok(progressHandler.includes("event?.type === 'reasoning'") && progressHandler.includes('persist: false'), 'Reasoning-only progress should update the UI without persisting project storage.');

console.log('Loredeck Creator generation progress persistence tests passed.');
