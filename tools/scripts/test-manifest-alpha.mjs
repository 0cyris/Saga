import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const manifest = JSON.parse(await readText('manifest.json'));
const readme = await readText('README.md');
const alphaSystems = await readText('docs/development/SAGA_ALPHA_RELEASE_SYSTEMS.md');
const releaseNotes = await readText(`docs/release/${manifest.version}.md`);

assert.equal(manifest.display_name, 'SAGA', 'Manifest display_name should remain SAGA.');
assert.equal(manifest.key, 'saga', 'Manifest key should remain saga.');
assert.match(
  manifest.version,
  /^0\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  'Alpha manifest version must stay pre-1.0.'
);
assert.match(manifest.version, /alpha/i, 'Alpha manifest version should include an alpha prerelease marker.');
assert.equal(manifest.auto_update, false, 'Alpha manifest must keep auto_update disabled.');
assert.match(
  String(manifest.minimum_client_version || ''),
  /^\d+\.\d+\.\d+$/,
  'Manifest must declare a concrete minimum_client_version.'
);

assert(readme.includes(manifest.version), 'README Status should mention the manifest alpha version.');
assert(readme.includes(manifest.minimum_client_version), 'README Status should mention the minimum SillyTavern version.');
assert(readme.includes(`docs/release/${manifest.version}.md`), 'README should link the current alpha release notes.');
assert.match(readme, /automatic updates are disabled|auto_update.+disabled/i, 'README should document manual alpha updates.');
assert.match(readme, /does not auto-open/i, 'README Fast Start should document the non-auto-open first-run behavior.');

assert(alphaSystems.includes('node tools/scripts/run-alpha-gate.mjs'), 'Alpha systems doc should publish the release gate command.');
assert(alphaSystems.includes('auto_update: false'), 'Alpha systems doc should document disabled automatic updates.');

assert(releaseNotes.includes(manifest.version), 'Release notes should mention the manifest alpha version.');
assert(releaseNotes.includes(manifest.minimum_client_version), 'Release notes should mention the minimum SillyTavern version.');
assert(releaseNotes.includes('auto_update: false'), 'Release notes should document disabled automatic updates.');
assert(releaseNotes.includes('node tools/scripts/run-alpha-gate.mjs'), 'Release notes should publish the release gate command.');
assert.match(releaseNotes, /Unsupported old imported state schemas are rejected/i, 'Release notes should document unsupported old-schema handling.');

console.log('Alpha manifest contract passed.');
