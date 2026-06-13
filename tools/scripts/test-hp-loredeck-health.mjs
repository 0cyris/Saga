import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DEFAULT_HP_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';
import { loadLoredeckSourceById } from '../../src/loredecks/loredeck-loader.js';

globalThis.fetch = async (url) => {
  const filePath = fileURLToPath(url);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return JSON.parse(await readFile(filePath, 'utf8'));
    },
  };
};

for (const deckId of DEFAULT_HP_LOREDECK_IDS) {
  const source = await loadLoredeckSourceById(deckId);
  const health = source.health;
  const issueSummary = [...health.errors, ...health.warnings, ...health.suggestions]
    .map(issue => `${issue.severity}:${issue.code}`)
    .join(', ');
  assert.equal(health.errors.length, 0, `${deckId} should have no Pack Health errors. ${issueSummary}`);
  assert.equal(health.warnings.length, 0, `${deckId} should have no Pack Health warnings. ${issueSummary}`);
  assert.equal(health.suggestions.length, 0, `${deckId} should have no Pack Health suggestions. ${issueSummary}`);
  assert.equal(health.status, 'good', `${deckId} should report good Pack Health.`);
}

console.log('HP Loredeck health tests passed.');
