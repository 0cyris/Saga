/**
 * test-loredeck-plugin-bundle.mjs -- Saga
 * Guards the loredeck-builder .skill bundle end to end. Nothing under
 * plugins/loredeck-builder/{skills,cli,docs,reference-decks} is committed --
 * it's generated fresh by sync-from-repo.mjs and zipped by
 * build-skill-file.mjs, so this test is what actually proves the pipeline
 * still produces a working, self-contained bundle:
 *   1. sync-from-repo.mjs regenerates the bundle from the repo without error.
 *   2. The vendored CLI resolves entirely within the bundle (no imports reach
 *      repo src/) and runs strict-clean Pack Health on the bundled reference
 *      deck via the vendored health engine.
 *   3. build-skill-file.mjs packages the bundle into a well-formed .skill zip
 *      containing the expected top-level entries.
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

// 1. Bundle regenerates cleanly from the repo (the only source of truth).
const sync = run(process.execPath, [path.join(pluginRoot, 'scripts', 'sync-from-repo.mjs')]);
assert.equal(sync.status, 0, `sync-from-repo.mjs failed: ${sync.stderr}`);

// 2. No vendored CLI file imports repo src/ -- the bundle must be self-contained.
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

// 4. The bundle packages into a well-formed, self-contained .skill zip.
const build = run(process.execPath, [path.join(pluginRoot, 'scripts', 'build-skill-file.mjs')]);
assert.equal(build.status, 0, `build-skill-file.mjs failed: ${build.stderr}`);
const skillPath = path.join(pluginRoot, 'dist', 'loredeck-builder.skill');
assert.ok(statSync(skillPath).size > 10_000, `.skill archive at ${skillPath} looks too small to be a real bundle.`);
const listing = run('python3', ['-m', 'zipfile', '-l', skillPath]);
assert.equal(listing.status, 0, `Failed to list .skill archive contents: ${listing.stderr}`);
for (const expected of [
  'loredeck-builder/SKILL.md',
  'loredeck-builder/cli/loredeck/loredeck-cli.mjs',
  'loredeck-builder/cli/vendor/tag-registry-health.js',
  'loredeck-builder/docs/SAGA_LOREDECK_SCHEMA.md',
  'loredeck-builder/reference-decks/hp-core/loredeck.json',
]) {
  assert.ok(listing.stdout.includes(expected), `.skill archive is missing expected entry: ${expected}`);
}

console.log('Loredeck plugin bundle tests passed.');
