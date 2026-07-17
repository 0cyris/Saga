/**
 * test-loredeck-cli-conformance.mjs -- Saga
 * The conformance command must pass the hp-core reference deck clean and
 * catch structural defects in a mutated fixture deck.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const fixtureRoot = path.join(repoRoot, '.tmp', 'test-loredeck-cli-conformance');
const mutatedDir = path.join(fixtureRoot, 'hp-core');

function conformance(deckDir) {
    const result = spawnSync(process.execPath, [cliPath, 'conformance', deckDir, '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
    });
    return { code: result.status, report: result.stdout ? JSON.parse(result.stdout) : null, stderr: result.stderr };
}

// Reference deck passes clean.
const reference = conformance(path.join(repoRoot, 'content', 'loredecks', 'hp-core'));
assert.equal(reference.code, 0, reference.stderr);
assert.deepEqual(reference.report.errors, [], 'hp-core must have no conformance errors.');
assert.deepEqual(reference.report.warnings, [], 'hp-core must have no conformance warnings.');

// Mutated copy fails with the expected defects.
await rm(fixtureRoot, { recursive: true, force: true });
await cp(path.join(repoRoot, 'content', 'loredecks', 'hp-core'), mutatedDir, { recursive: true });
const manifestPath = path.join(mutatedDir, 'loredeck.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.stats.entryCount += 5;
manifest.stats.timelineAnchorCount = Number(manifest.stats.timelineAnchorCount || 0) + 3;
manifest.stats.timelineWindowCount = Number(manifest.stats.timelineWindowCount || 0) + 2;
manifest.files.push('characters/does_not_exist.json');
manifest.registries.tags = 'missing-tags.json';
manifest.family = { id: 'hp-golden-trio', role: 'saga', recommendedCoreDeckId: '' };
manifest.assets = { ...(manifest.assets || {}), cover: { path: 'assets/hp-core-cover-wrong-name.png', alt: 'Cover' } };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
// leave manifest.json untouched so the duplicate-divergence check fires

const mutated = conformance(mutatedDir);
assert.equal(mutated.code, 1, 'Mutated deck must fail conformance.');
const errors = mutated.report.errors.join('\n');
assert.ok(errors.includes('missing entry file: characters/does_not_exist.json'), errors);
assert.ok(errors.includes('Registry tags points to a missing file'), errors);
assert.ok(errors.includes('stats.entryCount'), errors);
assert.ok(errors.includes('stats.timelineAnchorCount'), errors);
assert.ok(errors.includes('stats.timelineWindowCount'), errors);
assert.ok(errors.includes('family.role'), errors);
assert.ok(errors.includes('manifest.json duplicate has diverged'), errors);
// Pack Health recomputes from the same real entry files as the raw recount, so a
// manifest-only mutation (no changes to actual entry files) must NOT trip the
// health cross-validation -- this proves the check doesn't false-positive.
assert.ok(!errors.includes('Pack Health'), errors);
const warnings = mutated.report.warnings.join('\n');
assert.ok(warnings.includes('does not follow the assets/cover'), warnings);

await rm(fixtureRoot, { recursive: true, force: true });
console.log('Loredeck CLI conformance tests passed.');
