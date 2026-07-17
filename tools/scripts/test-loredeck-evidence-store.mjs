/**
 * test-loredeck-evidence-store.mjs -- Saga
 * Exercises the evidence pipeline: schema validation, accept/reject review
 * decisions, and the cards report's accepted-evidence backing check.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-evidence-store');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectDir = path.join(workshopRoot, 'evidence-canon');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', 'evidence-canon', '--title', 'Evidence Canon').code, 0);

// valid + invalid evidence files
await mkdir(path.join(projectDir, 'evidence', 'chapters'), { recursive: true });
await writeFile(path.join(projectDir, 'evidence', 'chapters', 'ch-1.json'), JSON.stringify({
    schemaVersion: 1,
    scope: 'chapters',
    sourceKind: 'user_supplied',
    provenance: { title: 'Novel, Chapter 1' },
    records: [
        { id: 'ch1-intro', title: 'Chapter 1 intro', keyEntities: ['Hero'], authoringSignals: ['character-baseline'], facts: ['The hero is a recruit.'] },
        { id: 'ch1-secret', title: 'Chapter 1 secret', keyEntities: ['Mentor'], authoringSignals: ['secret-knowledge gate'], facts: ['The mentor hides a past.'] },
    ],
    failures: [],
}, null, 2));
await writeFile(path.join(projectDir, 'evidence', 'chapters', 'bad.json'), JSON.stringify({
    schemaVersion: 1,
    scope: 'chapters',
    sourceKind: 'web',
    provenance: {},
    records: [{ id: 'dup', title: 'A', facts: ['x'] }, { id: 'dup', title: '', facts: [] }],
}, null, 2));

const invalid = cli('evidence', 'validate', 'evidence-canon', '--json');
assert.equal(invalid.code, 1, 'Validation must fail while issues exist.');
const invalidReport = JSON.parse(invalid.stdout);
assert.ok(invalidReport.issues.some(issue => issue.includes('provenance.url')), 'Web evidence without provenance.url must be flagged.');
assert.ok(invalidReport.issues.some(issue => issue.includes('duplicate record id')), 'Duplicate record ids must be flagged.');
assert.equal(invalidReport.counts.total, 4);

await rm(path.join(projectDir, 'evidence', 'chapters', 'bad.json'));
const valid = cli('evidence', 'validate', 'evidence-canon', '--json');
assert.equal(valid.code, 0, valid.stdout);
assert.equal(JSON.parse(valid.stdout).counts.pending, 2);

// accept one, reject one
assert.equal(cli('evidence', 'accept', 'evidence-canon', '--scope', 'chapters', '--ids', 'ch1-intro').code, 0);
assert.equal(cli('evidence', 'reject', 'evidence-canon', '--scope', 'chapters', '--ids', 'ch1-secret', '--note', 'unsourced').code, 0);
const counts = JSON.parse(cli('evidence', 'validate', 'evidence-canon', '--json').stdout).counts;
assert.deepEqual({ accepted: counts.accepted, rejected: counts.rejected, pending: counts.pending }, { accepted: 1, rejected: 1, pending: 0 });
const missing = cli('evidence', 'accept', 'evidence-canon', '--scope', 'chapters', '--ids', 'nope');
assert.equal(missing.code, 1, 'Accepting unknown evidence ids must fail.');

// evidence review artifact reflects statuses
const artifact = await readFile(path.join(projectDir, 'reviews', 'evidence.md'), 'utf8');
assert.ok(artifact.includes('chapters/ch1-intro'));
assert.ok(artifact.includes('accepted'));
assert.ok(artifact.includes('rejected'));

// cards report flags unbacked cards
const deckDir = path.join(projectDir, 'drafts', 'evidence-canon');
await mkdir(path.join(deckDir, 'knowledge'), { recursive: true });
const makeEntry = (id, evidenceRefs) => ({
    schemaVersion: 3,
    id,
    title: id,
    category: 'knowledge',
    priority: 100,
    tags: [],
    content: { fact: 'Fact.', injection: 'Injection.' },
    sourceInfo: evidenceRefs === null ? {} : { evidenceRefs },
});
await writeFile(path.join(deckDir, 'knowledge', 'cards.json'), JSON.stringify({
    schemaVersion: 3,
    entries: [
        makeEntry('card.backed', ['chapters/ch1-intro']),
        makeEntry('card.rejected-ref', ['chapters/ch1-secret']),
        makeEntry('card.unbacked', null),
    ],
}, null, 2));
const manifestPath = path.join(deckDir, 'loredeck.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.files = ['knowledge/cards.json'];
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

const cards = cli('report', 'evidence-canon', '--stage', 'cards', '--json');
assert.equal(cards.code, 0, cards.stderr);
const cardsJson = JSON.parse(cards.stdout);
assert.equal(cardsJson.unbacked, 2, 'Rejected-ref and no-ref cards must both be flagged.');
assert.equal(cardsJson.crossDeckCitations, 0, 'Evidence without a deckId must never trigger a cross-deck citation warning.');
assert.equal(cardsJson.unbackedCards, undefined, 'Non-verbose JSON output must not include per-card detail.');

// --verbose surfaces the per-card detail already computed by buildCardsArtifact
const verboseCards = cli('report', 'evidence-canon', '--stage', 'cards', '--verbose', '--json');
assert.equal(verboseCards.code, 0, verboseCards.stderr);
const verboseCardsJson = JSON.parse(verboseCards.stdout);
assert.equal(verboseCardsJson.unbackedCards.length, 2, '--verbose --json must list both unbacked cards.');
const verboseIds = verboseCardsJson.unbackedCards.map(item => item.id).sort();
assert.deepEqual(verboseIds, ['card.rejected-ref', 'card.unbacked']);
assert.equal(verboseCardsJson.crossDeckCitationDetail.length, 0);

const verboseCardsText = cli('report', 'evidence-canon', '--stage', 'cards', '--verbose');
assert.equal(verboseCardsText.code, 0, verboseCardsText.stderr);
assert.ok(verboseCardsText.stdout.includes('card.unbacked'), '--verbose text output must name unbacked cards.');
assert.ok(verboseCardsText.stdout.includes('card.rejected-ref'), '--verbose text output must name cards with unaccepted refs.');

const cardsArtifact = await readFile(path.join(projectDir, 'reviews', 'cards.md'), 'utf8');
assert.ok(cardsArtifact.includes('card.unbacked'));
assert.ok(cardsArtifact.includes('card.rejected-ref'));
assert.ok(!cardsArtifact.includes('| card.backed |') || !cardsArtifact.split('Cards without accepted evidence backing')[1].includes('card.backed'), 'Backed card must not be flagged.');

// evidence deckId + cross-deck citation warning (item 6)
const familyProjectDir = path.join(workshopRoot, 'evidence-family');
assert.equal(cli('init', 'evidence-family', '--title', 'Evidence Family', '--size', 'family', '--decks', 'ef-a:core,ef-b:era').code, 0);

// deckId must be a valid slug when present.
await mkdir(path.join(familyProjectDir, 'evidence'), { recursive: true });
await writeFile(path.join(familyProjectDir, 'evidence', 'bad-deck-id.json'), JSON.stringify({
    schemaVersion: 1,
    scope: 'lore',
    deckId: 'Not A Slug',
    sourceKind: 'user_supplied',
    provenance: { title: 'Fixture' },
    records: [{ id: 'x', title: 'X', facts: ['x'] }],
}, null, 2));
const badDeckIdValidation = cli('evidence', 'validate', 'evidence-family', '--json');
assert.equal(badDeckIdValidation.code, 1, 'A malformed deckId must fail validation.');
assert.ok(JSON.parse(badDeckIdValidation.stdout).issues.some(issue => issue.includes('deckId must be a lowercase slug')));
await rm(path.join(familyProjectDir, 'evidence', 'bad-deck-id.json'));

await writeFile(path.join(familyProjectDir, 'evidence', 'lore.json'), JSON.stringify({
    schemaVersion: 1,
    scope: 'lore',
    deckId: 'ef-a',
    sourceKind: 'user_supplied',
    provenance: { title: 'Fixture' },
    records: [{ id: 'fact-a', title: 'Fact A', facts: ['A fact for deck ef-a.'] }],
}, null, 2));
assert.equal(cli('evidence', 'accept', 'evidence-family', '--scope', 'lore', '--ids', 'fact-a').code, 0);

const makeFamilyEntry = (id, evidenceRefs) => ({
    schemaVersion: 3,
    id,
    title: id,
    category: 'knowledge',
    priority: 100,
    tags: [],
    content: { fact: 'Fact.', injection: 'Injection.' },
    sourceInfo: { evidenceRefs },
});
for (const deckId of ['ef-a', 'ef-b']) {
    const familyDeckDir = path.join(familyProjectDir, 'drafts', deckId);
    await mkdir(path.join(familyDeckDir, 'knowledge'), { recursive: true });
    await writeFile(path.join(familyDeckDir, 'knowledge', 'cards.json'), JSON.stringify({
        schemaVersion: 3,
        entries: [makeFamilyEntry(`card.${deckId}`, ['lore/fact-a'])],
    }, null, 2));
    const familyManifestPath = path.join(familyDeckDir, 'loredeck.json');
    const familyManifest = JSON.parse(await readFile(familyManifestPath, 'utf8'));
    familyManifest.files = ['knowledge/cards.json'];
    await writeFile(familyManifestPath, JSON.stringify(familyManifest, null, 2));
}

const familyCards = cli('report', 'evidence-family', '--stage', 'cards', '--verbose', '--json');
assert.equal(familyCards.code, 0, familyCards.stderr);
const familyCardsJson = JSON.parse(familyCards.stdout);
assert.equal(familyCardsJson.crossDeckCitations, 1, 'Only the citing deck that differs from the evidence deckId must be flagged.');
assert.equal(familyCardsJson.crossDeckCitationDetail[0].id, 'card.ef-b', 'The card in the non-owning deck (ef-b) must be flagged, not the owning deck (ef-a).');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck evidence store tests passed.');
