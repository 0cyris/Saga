/**
 * test-loredeck-workshop-state.mjs -- Saga
 * Exercises the loredeck CLI workshop project lifecycle: init, status
 * resume contract, gate approvals, invalid transitions, and batch records.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-workshop-state');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function cliJson(...args) {
    const result = cli(...args, '--json');
    assert.equal(result.code, 0, `Expected success from ${args.join(' ')}: ${result.stderr || result.stdout}`);
    return JSON.parse(result.stdout);
}

await rm(workshopRoot, { recursive: true, force: true });

// init + resume contract
const init = cli('init', 'state-canon', '--title', 'State Canon', '--size', 'family', '--decks', 'state-canon-core:core,state-canon-era-one:era');
assert.equal(init.code, 0, init.stderr);
const reInit = cli('init', 'state-canon', '--title', 'State Canon');
assert.equal(reInit.code, 1, 'Re-init of an existing project must fail.');

let status = cliJson('status', 'state-canon');
assert.equal(status.stage, 'intake');
assert.equal(status.pendingGate, 'intent_confirmed');
assert.deepEqual(status.decks.map(deck => deck.deckId), ['state-canon-core', 'state-canon-era-one']);
assert.equal(status.decks[0].role, 'core');

// invalid project ids and unknown projects
assert.equal(cli('status', 'No Such Project').code, 1, 'Invalid project id must fail.');
assert.equal(cli('status', 'missing-project').code, 1, 'Unknown project must fail.');

// gate approvals walk the stage machine in order
const expectedStages = ['scope_brief', 'evidence', 'planning', 'titles', 'cards', 'health', 'package', 'complete'];
for (const expected of expectedStages) {
    const gate = cliJson('gate', 'approve', 'state-canon', '--note', `advance to ${expected}`);
    assert.equal(gate.stage, expected, `Gate approval should advance to ${expected}.`);
}
const overrun = cli('gate', 'approve', 'state-canon');
assert.equal(overrun.code, 1, 'Approving a gate at the complete stage must fail.');

status = cliJson('status', 'state-canon');
assert.equal(status.stage, 'complete');
assert.equal(status.pendingGate, null);
assert.equal(status.gatesApproved.length, 8, 'All eight gates should be recorded.');
assert.ok(status.gatesApproved.includes('final_package_signed_off'));

// batch records
const batch = cliJson('batch', 'set', 'state-canon', '--deck', 'state-canon-core', '--kind', 'titles', '--id', 'batch-1', '--status', 'approved', '--count', '12');
assert.equal(batch.batches['state-canon-core'].titles[0].status, 'approved');
assert.equal(batch.batches['state-canon-core'].titles[0].count, 12);
const badBatch = cli('batch', 'set', 'state-canon', '--deck', 'nope', '--kind', 'titles', '--id', 'b', '--status', 'approved');
assert.equal(badBatch.code, 1, 'Batch for an unknown deck must fail.');
const badKind = cli('batch', 'set', 'state-canon', '--deck', 'state-canon-core', '--kind', 'chapters', '--id', 'b', '--status', 'approved');
assert.equal(badKind.code, 1, 'Unknown batch kind must fail.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck workshop state tests passed.');
