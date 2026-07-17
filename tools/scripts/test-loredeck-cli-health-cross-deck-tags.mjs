/**
 * test-loredeck-cli-health-cross-deck-tags.mjs -- Saga
 * Exercises Pack Health's cross-deck tag-parent resolution: an era deck's
 * tag parented to a tag defined only in its family's core deck should not
 * flag `tag_parent_missing` when health-checked through the project, while
 * a genuinely undefined parent still flags, and a bare-directory (no
 * project context) invocation still flags too (graceful degrade).
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-cli-health-cross-deck-tags');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const reportsDir = path.join(workshopRoot, 'reports');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

async function writeTags(deckDir, tags) {
    await writeFile(path.join(deckDir, 'tags.json'), `${JSON.stringify({ schemaVersion: 1, tags }, null, 2)}\n`, 'utf8');
}

async function warningCodes(reportPath) {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    return report.warnings.map(issue => issue.code);
}

await rm(workshopRoot, { recursive: true, force: true });

const init = cli('init', 'dl-family', '--title', 'Dragonlance Family', '--size', 'family', '--decks', 'dl-core:core,dl-module:era');
assert.equal(init.code, 0, init.stderr);

const projectDraftsDir = path.join(workshopRoot, 'dl-family', 'drafts');
const coreDir = path.join(projectDraftsDir, 'dl-core');
const moduleDir = path.join(projectDraftsDir, 'dl-module');

const moduleManifest = JSON.parse(await readFile(path.join(moduleDir, 'loredeck.json'), 'utf8'));
assert.equal(moduleManifest.family?.recommendedCoreDeckId, 'dl-core', 'init should link the era deck to its core deck.');

await writeTags(coreDir, {
    'race:dwarf': { label: 'Dwarf' },
});
await writeTags(moduleDir, {
    'faction:dragonarmy-red': { label: 'Dragonarmy Red', parents: ['race:dwarf'] },
    'faction:nonexistent': { label: 'Nonexistent Parent', parents: ['totally:missing'] },
});

// Health-checked through the project: the core-defined parent resolves, the genuinely undefined one still flags.
const moduleHealth = cli('health', 'dl-family', '--deck', 'dl-module', '--out', reportsDir);
assert.equal(moduleHealth.code, 0, moduleHealth.stderr);
const moduleReport = JSON.parse(await readFile(path.join(reportsDir, 'health-dl-module.json'), 'utf8'));
const parentMissingIssues = moduleReport.warnings.filter(issue => issue.code === 'tag_parent_missing');
assert.equal(parentMissingIssues.length, 1, 'Only the genuinely-undefined parent should flag tag_parent_missing.');
assert.equal(parentMissingIssues[0].parentTagId, 'totally:missing', 'The flagged parent must be the undefined one, not the core-resolved one.');

// The core deck's own health run must be unaffected (no self-inflation from the module deck's registry).
const coreHealth = cli('health', 'dl-family', '--deck', 'dl-core', '--out', reportsDir);
assert.equal(coreHealth.code, 0, coreHealth.stderr);
const coreCodes = await warningCodes(path.join(reportsDir, 'health-dl-core.json'));
assert.ok(!coreCodes.includes('tag_parent_missing'), 'Core deck health must not be affected by the module deck.');

// Bare-directory invocation (no project context) must gracefully degrade to today's behavior: still flags.
const bareHealth = cli('health', moduleDir, '--out', reportsDir);
assert.equal(bareHealth.code, 0, bareHealth.stderr);
const bareReport = JSON.parse(await readFile(path.join(reportsDir, `health-${path.basename(moduleDir)}.json`), 'utf8'));
const bareParentMissing = bareReport.warnings.filter(issue => issue.code === 'tag_parent_missing');
assert.equal(bareParentMissing.length, 2, 'Without project context, both parents (including the core-defined one) must flag.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck CLI cross-deck tag health tests passed.');
