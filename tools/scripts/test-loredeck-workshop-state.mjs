/**
 * test-loredeck-workshop-state.mjs -- Saga
 * Exercises the loredeck CLI workshop project lifecycle: init, status
 * resume contract, gate approvals, invalid transitions, and batch records.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
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

const coreManifest = JSON.parse(await readFile(path.join(workshopRoot, 'state-canon', 'drafts', 'state-canon-core', 'loredeck.json'), 'utf8'));
assert.deepEqual(coreManifest.library.suggestedPath, ['State Canon'], 'Every deck in a project should share one suggestedPath, not get its own subfolder.');
const eraManifest = JSON.parse(await readFile(path.join(workshopRoot, 'state-canon', 'drafts', 'state-canon-era-one', 'loredeck.json'), 'utf8'));
assert.deepEqual(eraManifest.library.suggestedPath, coreManifest.library.suggestedPath, 'Sibling decks must share the exact same suggestedPath as the core deck.');
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

// gate reopen rewinds a completed project so a new deck's cycle can run
const badReopenNoStage = cli('gate', 'reopen', 'state-canon');
assert.equal(badReopenNoStage.code, 1, 'reopen without --stage must fail.');
const badReopenUnknownStage = cli('gate', 'reopen', 'state-canon', '--stage', 'nope');
assert.equal(badReopenUnknownStage.code, 1, 'reopen to an unknown stage must fail.');
const badReopenForward = cli('gate', 'reopen', 'state-canon', '--stage', 'complete');
assert.equal(badReopenForward.code, 0, 'reopen to the current stage (no-op) is allowed.');
const reopened = cliJson('gate', 'reopen', 'state-canon', '--stage', 'titles', '--note', 'new deck added to the family');
assert.equal(reopened.stage, 'titles');
status = cliJson('status', 'state-canon');
assert.equal(status.stage, 'titles');
assert.equal(status.pendingGate, 'titles_approved');
assert.equal(status.gatesApproved.length, 8, 'Reopening must not remove prior gate history.');
const reopenPastCurrent = cli('gate', 'reopen', 'state-canon', '--stage', 'package');
assert.equal(reopenPastCurrent.code, 1, 'reopen must not be usable to skip forward past the current stage.');
for (const expected of ['cards', 'health', 'package', 'complete']) {
    const gate = cliJson('gate', 'approve', 'state-canon');
    assert.equal(gate.stage, expected, `Second cycle's gate approval should advance to ${expected}.`);
}
status = cliJson('status', 'state-canon');
assert.equal(status.gatesApproved.length, 12, 'Second cycle should append 4 more gate entries, not replace the first cycle.');

// per-deck gate approve/reopen walk a deck's own stage independently (items 1+5)
const perDeckInit = cli('init', 'per-deck-canon', '--title', 'Per Deck Canon', '--size', 'family', '--decks', 'per-deck-core:core,per-deck-era:era');
assert.equal(perDeckInit.code, 0, perDeckInit.stderr);

const badDeckApprove = cli('gate', 'approve', 'per-deck-canon', '--deck', 'nope');
assert.equal(badDeckApprove.code, 1, 'Approving a gate for an unknown deck must fail.');

const deckExpectedStages = ['scope_brief', 'evidence', 'planning'];
for (const expected of deckExpectedStages) {
    const gate = cliJson('gate', 'approve', 'per-deck-canon', '--deck', 'per-deck-era', '--note', `advance era to ${expected}`);
    assert.equal(gate.deckId, 'per-deck-era');
    assert.equal(gate.stage, expected, `Deck-scoped gate approval should advance the deck to ${expected}.`);
}
let perDeckStatus = cliJson('status', 'per-deck-canon');
assert.equal(perDeckStatus.stage, 'intake', 'Project-wide stage must be unaffected by deck-scoped gate approvals.');
assert.deepEqual(
    perDeckStatus.decks.map(deck => [deck.deckId, deck.stage]),
    [['per-deck-core', 'pending'], ['per-deck-era', 'planning']],
    'Only the targeted deck\'s stage should advance; the sibling deck must stay untouched.',
);
assert.equal(perDeckStatus.gates.filter(gate => gate.deckId === 'per-deck-era').length, 3);
assert.equal(perDeckStatus.gates.filter(gate => !gate.deckId).length, 0, 'Flat (project-wide) gate entries must not appear from deck-scoped calls.');
assert.equal(perDeckStatus.gatesApproved.length, 3, 'gatesApproved must include the deck-scoped gates too.');

// gate reopen --deck rewinds only the targeted deck, with the same forward-jump guard as the flat path
const badDeckReopenForward = cli('gate', 'reopen', 'per-deck-canon', '--deck', 'per-deck-era', '--stage', 'complete');
assert.equal(badDeckReopenForward.code, 1, 'Deck-scoped reopen must not be usable to skip forward past the deck\'s current stage.');
const deckReopened = cliJson('gate', 'reopen', 'per-deck-canon', '--deck', 'per-deck-era', '--stage', 'evidence', '--note', 'redo evidence for era deck');
assert.equal(deckReopened.deckId, 'per-deck-era');
assert.equal(deckReopened.stage, 'evidence');
perDeckStatus = cliJson('status', 'per-deck-canon');
assert.equal(perDeckStatus.decks.find(deck => deck.deckId === 'per-deck-era').stage, 'evidence');
assert.equal(perDeckStatus.decks.find(deck => deck.deckId === 'per-deck-core').stage, 'pending', 'Reopening one deck must not affect its sibling.');
assert.equal(perDeckStatus.gates.filter(gate => gate.deckId === 'per-deck-era').length, 3, 'Reopening must not remove prior deck-scoped gate history.');

// The project-wide flat path still works independently of any deck-scoped activity.
const flatGate = cliJson('gate', 'approve', 'per-deck-canon');
assert.equal(flatGate.stage, 'scope_brief');
assert.equal(flatGate.deckId, undefined, 'Flat-path JSON output must not include a deckId key.');
perDeckStatus = cliJson('status', 'per-deck-canon');
assert.equal(perDeckStatus.stage, 'scope_brief', 'Flat project-wide stage advances independently of per-deck stages.');
assert.equal(perDeckStatus.decks.find(deck => deck.deckId === 'per-deck-era').stage, 'evidence', 'Flat-path approval must not touch any deck\'s per-deck stage.');

// deck add extends an already-initialized project's decks[] (item 4)
const deckAddInit = cli('init', 'deck-add-canon', '--title', 'Deck Add Canon', '--size', 'family', '--decks', 'deck-add-core:core');
assert.equal(deckAddInit.code, 0, deckAddInit.stderr);
// Advance the project-wide stage first -- this is the exact issue scenario: a deck
// added after the project has already progressed must not inherit that progress.
for (let i = 0; i < 3; i += 1) assert.equal(cli('gate', 'approve', 'deck-add-canon').code, 0);

const addedDeck = cliJson('deck', 'add', 'deck-add-canon', '--deck', 'deck-add-era:era');
assert.equal(addedDeck.deck.deckId, 'deck-add-era');
assert.equal(addedDeck.deck.role, 'era');
assert.equal(addedDeck.deck.stage, 'pending');

const dupDeckAdd = cli('deck', 'add', 'deck-add-canon', '--deck', 'deck-add-era:era');
assert.equal(dupDeckAdd.code, 1, 'Adding a duplicate deck id must fail.');
const invalidDeckAdd = cli('deck', 'add', 'deck-add-canon', '--deck', 'Not A Slug:era');
assert.equal(invalidDeckAdd.code, 1, 'Adding an invalid deck id must fail.');
const missingProjectDeckAdd = cli('deck', 'add', 'missing-project', '--deck', 'x:era');
assert.equal(missingProjectDeckAdd.code, 1, 'deck add on an unknown project must fail.');

const addedManifest = JSON.parse(await readFile(path.join(workshopRoot, 'deck-add-canon', 'drafts', 'deck-add-era', 'loredeck.json'), 'utf8'));
assert.equal(addedManifest.family?.recommendedCoreDeckId, 'deck-add-core', 'Added deck must link to the existing core deck, same as init would.');
assert.deepEqual(addedManifest.library.suggestedPath, ['Deck Add Canon'], 'A deck added later must share the same project-wide suggestedPath init would have produced directly, not get its own subfolder.');
const addedTags = JSON.parse(await readFile(path.join(workshopRoot, 'deck-add-canon', 'drafts', 'deck-add-era', 'tags.json'), 'utf8'));
assert.deepEqual(addedTags, { schemaVersion: 1, tags: {} });

let deckAddStatus = cliJson('status', 'deck-add-canon');
assert.deepEqual(deckAddStatus.decks.map(deck => deck.deckId), ['deck-add-core', 'deck-add-era']);
assert.equal(deckAddStatus.decks[1].stage, 'pending', 'A deck added after the project advanced must not inherit the project\'s progress.');

// The newly-added deck can be gated independently of the rest of the family (the exact issue-1 scenario).
const addedDeckGate = cliJson('gate', 'approve', 'deck-add-canon', '--deck', 'deck-add-era');
assert.equal(addedDeckGate.stage, 'scope_brief', 'The newly-added deck must start its own per-deck walk cleanly from intake.');
deckAddStatus = cliJson('status', 'deck-add-canon');
assert.equal(deckAddStatus.stage, 'planning', 'The core deck\'s project-wide progress must be unaffected by the new deck\'s gating.');

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
