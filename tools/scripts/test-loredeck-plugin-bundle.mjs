/**
 * test-loredeck-plugin-bundle.mjs -- Saga
 * Guards the vendored loredeck-builder plugin bundle:
 *   1. The bundle is in sync with the repo (re-running sync-from-repo.mjs
 *      produces no diff).
 *   2. The vendored CLI resolves entirely within the plugin (no imports reach
 *      repo src/) and runs strict-clean Pack Health on the bundled reference
 *      deck via the vendored health engine.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const pluginRoot = path.join(repoRoot, 'plugins', 'loredeck-builder');

function run(cmd, args, env = {}) {
  return spawnSync(cmd, args, { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, ...env } });
}

// 1. Bundle is regenerable and in sync with the repo.
const sync = run(process.execPath, [path.join(pluginRoot, 'scripts', 'sync-from-repo.mjs')]);
assert.equal(sync.status, 0, `sync-from-repo.mjs failed: ${sync.stderr}`);
const diff = run('git', ['diff', '--stat', '--', 'plugins/loredeck-builder']);
assert.equal(diff.status, 0, 'git diff failed');
assert.equal(
  diff.stdout.trim(),
  '',
  `Plugin bundle is out of sync with the repo. Run:\n  node plugins/loredeck-builder/scripts/sync-from-repo.mjs\nand commit. Drift:\n${diff.stdout}`,
);

// 2. No vendored CLI file imports repo src/.
function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}
const importRe = /^\s*(?:import|export)[^\n]*from\s+['"][^'"]*(?:src\/loredecks|src\/lorecards)[^'"]*['"]/m;
for (const file of listFiles(path.join(pluginRoot, 'cli'))) {
  if (!file.endsWith('.mjs') && !file.endsWith('.js')) continue;
  assert.ok(!importRe.test(readFileSync(file, 'utf8')), `${path.relative(repoRoot, file)} imports repo src/ — bundle is not self-contained.`);
}

// 3. Vendored CLI runs strict-clean health on the bundled reference deck.
const referenceDeck = path.join(pluginRoot, 'reference-decks', 'hp-core');
assert.ok(statSync(referenceDeck).isDirectory(), 'bundled reference deck hp-core is missing');
const health = run(process.execPath, [
  path.join(pluginRoot, 'cli', 'loredeck-plugin.mjs'), 'health', referenceDeck, '--strict', '--json',
], { SAGA_WORKSHOP_ROOT: path.join(repoRoot, '.tmp', 'plugin-bundle-test-workshop') });
assert.equal(health.status, 0, `vendored strict health on hp-core failed: ${health.stdout}${health.stderr}`);
const report = JSON.parse(health.stdout);
assert.equal(report.ok, true);
assert.equal(report.decks[0].status, 'good');
assert.equal(report.decks[0].errors + report.decks[0].warnings + report.decks[0].suggestions, 0);

console.log('Loredeck plugin bundle tests passed.');
