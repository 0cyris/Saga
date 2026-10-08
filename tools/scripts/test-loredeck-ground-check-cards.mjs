/**
 * test-loredeck-ground-check-cards.mjs -- Saga
 * Exercises fact-level grounding for drafted cards: `ground check --stage
 * cards` must pass a clean deck and flag each failure class on
 * `sourceInfo.evidenceFacts` (missing / empty / non-array, unknown or
 * unaccepted record, out-of-range index, empty fact, malformed or duplicate
 * pointer, pointer outside `sourceInfo.evidenceRefs`, unreadable entry file),
 * and `report --stage cards` must show each card's claim next to the facts it
 * points at without changing its existing checks or ever blocking.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-ground-check-cards');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectId = 'ground-cards';
const projectDir = path.join(workshopRoot, projectId);
const deckDir = path.join(projectDir, 'drafts', projectId);
const entryFile = path.join(deckDir, 'characters', 'main_cast.json');
const BATCH = 'characters/main_cast';

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function groundCheck() {
    const result = cli('ground', 'check', projectId, '--stage', 'cards', '--json');
    return { code: result.code, report: JSON.parse(result.stdout) };
}

const FACT_MARA = 'Mara Venn is introduced as a 17-year-old conscript with no prior combat training.';
const FACT_RAVENHOLD = 'Ravenhold Keep is a mountain garrison controlled by the Warden\'s Order at the story\'s start.';
const FACT_PACT = 'Warden Sethe is revealed to have secretly sworn to the Ashen Pact before the events of Book 1.';

const evidenceFile = {
    schemaVersion: 1,
    scope: 'chapters',
    deckId: '',
    sourceKind: 'user_supplied',
    provenance: { url: '', title: 'Founding Trilogy reader notes', retrievedAt: '2026-10-08' },
    records: [
        { id: 'canon-ch-01', title: 'Chapter 1', facts: [FACT_MARA, FACT_RAVENHOLD] },
        { id: 'canon-ch-14', title: 'Chapter 14', facts: [FACT_PACT, ' '] },
        { id: 'canon-ch-20', title: 'Chapter 20 (still pending review)', facts: ['Pending fact.'] },
    ],
    failures: [],
};

function card(id, { fact, injection, evidenceRefs, evidenceFacts }) {
    return {
        schemaVersion: 3,
        id,
        title: id,
        category: 'character',
        priority: 100,
        content: { fact, injection },
        sourceInfo: { work: 'Ground Cards', sourceType: 'book', evidenceRefs, evidenceFacts },
    };
}

function cleanCards() {
    return [
        card('canon.character.mara-venn', {
            fact: 'Mara Venn is an untrained 17-year-old conscript.',
            injection: 'Treat Mara as an untrained teenage conscript.',
            evidenceRefs: ['chapters/canon-ch-01'],
            evidenceFacts: ['chapters/canon-ch-01#0'],
        }),
        card('canon.secret.sethe-ashen-pact', {
            fact: 'Warden Sethe swore to the Ashen Pact before Book 1.',
            injection: 'Sethe is secretly sworn to the Ashen Pact.',
            evidenceRefs: ['chapters/canon-ch-14'],
            evidenceFacts: ['chapters/canon-ch-14#0'],
        }),
    ];
}

async function writeCards(entries) {
    await writeFile(entryFile, `${JSON.stringify({ schemaVersion: 3, entries }, null, 2)}\n`);
}

// --- Project setup: one draft deck with a category subfolder listed in files[] ---
await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', projectId, '--title', 'Ground Cards').code, 0);
await mkdir(path.join(projectDir, 'evidence'), { recursive: true });
await writeFile(path.join(projectDir, 'evidence', 'chapters.json'), `${JSON.stringify(evidenceFile, null, 2)}\n`);
const accept = cli('evidence', 'accept', projectId, '--scope', 'chapters', '--ids', 'canon-ch-01,canon-ch-14');
assert.equal(accept.code, 0, accept.stderr || accept.stdout);
await mkdir(path.dirname(entryFile), { recursive: true });
await writeCards(cleanCards());
const stats = cli('stats', deckDir, '--write');
assert.equal(stats.code, 0, stats.stderr || stats.stdout);

// --- Clean deck passes; root-level registry JSON is never read as entries ---
const clean = groundCheck();
assert.equal(clean.code, 0, JSON.stringify(clean.report));
assert.equal(clean.report.ok, true);
assert.equal(clean.report.stage, 'cards');
assert.equal(clean.report.checked, 2);
assert.deepEqual(clean.report.issues, []);
const cleanText = cli('ground', 'check', projectId, '--stage', 'cards', '--deck', projectId);
assert.equal(cleanText.code, 0, cleanText.stderr);
assert.ok(cleanText.stdout.includes('2 item(s) checked, 0 issue(s)'), cleanText.stdout);

// --- Each failure class is flagged on the first card, with kind, itemId, batch, pointer and problem ---
const cases = [
    { name: 'missing evidenceFacts', mutate: (c) => { delete c.sourceInfo.evidenceFacts; }, pointer: null, problem: 'missing-support', detail: 'sourceInfo.evidenceFacts is missing' },
    { name: 'empty evidenceFacts', mutate: (c) => { c.sourceInfo.evidenceFacts = []; }, pointer: null, problem: 'missing-support' },
    { name: 'non-array evidenceFacts', mutate: (c) => { c.sourceInfo.evidenceFacts = 'chapters/canon-ch-01#0'; }, pointer: null, problem: 'missing-support' },
    { name: 'missing sourceInfo', mutate: (c) => { delete c.sourceInfo; }, pointer: null, problem: 'missing-support' },
    { name: 'unknown record', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-99#0']; c.sourceInfo.evidenceRefs = ['chapters/canon-ch-99']; }, pointer: 'chapters/canon-ch-99#0', problem: 'unknown-record' },
    { name: 'unaccepted record', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-20#0']; c.sourceInfo.evidenceRefs = ['chapters/canon-ch-20']; }, pointer: 'chapters/canon-ch-20#0', problem: 'unaccepted-record' },
    { name: 'out-of-range fact index', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-01#2']; }, pointer: 'chapters/canon-ch-01#2', problem: 'fact-out-of-range' },
    { name: 'empty fact', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-14#1']; c.sourceInfo.evidenceRefs = ['chapters/canon-ch-14']; }, pointer: 'chapters/canon-ch-14#1', problem: 'empty-fact' },
    { name: 'malformed pointer', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-01:0']; }, pointer: 'chapters/canon-ch-01:0', problem: 'malformed-pointer' },
    { name: 'duplicate pointer', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-01#0', 'chapters/canon-ch-01#0']; }, pointer: 'chapters/canon-ch-01#0', problem: 'duplicate-pointer' },
    { name: 'pointer outside evidenceRefs', mutate: (c) => { c.sourceInfo.evidenceFacts = ['chapters/canon-ch-14#0']; }, pointer: 'chapters/canon-ch-14#0', problem: 'not-in-evidence-refs' },
];
for (const testCase of cases) {
    const entries = cleanCards();
    testCase.mutate(entries[0]);
    await writeCards(entries);
    const { code, report } = groundCheck();
    assert.equal(code, 1, `${testCase.name}: ground check should exit 1.`);
    assert.equal(report.ok, false, `${testCase.name}: ok should be false.`);
    assert.equal(report.issues.length, 1, `${testCase.name}: expected exactly one issue, got ${JSON.stringify(report.issues)}`);
    const [issue] = report.issues;
    assert.equal(issue.deck, projectId, `${testCase.name}: deck`);
    assert.equal(issue.kind, 'card', `${testCase.name}: kind`);
    assert.equal(issue.itemId, 'canon.character.mara-venn', `${testCase.name}: itemId`);
    assert.equal(issue.batch, BATCH, `${testCase.name}: batch`);
    assert.equal(issue.pointer, testCase.pointer, `${testCase.name}: pointer`);
    assert.equal(issue.problem, testCase.problem, `${testCase.name}: problem`);
    if (testCase.detail) assert.equal(issue.detail, testCase.detail, `${testCase.name}: detail`);
}

// --- An unreadable entry file listed in files[] is an invalid-batch-file issue ---
await writeCards(cleanCards());
const brokenFile = path.join(deckDir, 'secrets', 'broken.json');
await mkdir(path.dirname(brokenFile), { recursive: true });
await writeFile(brokenFile, '{ not json');
assert.equal(cli('stats', deckDir, '--write').code, 0);
const broken = groundCheck();
assert.equal(broken.code, 1);
assert.equal(broken.report.checked, 2, 'Readable entry files are still checked.');
assert.deepEqual(broken.report.issues.map(issue => [issue.kind, issue.batch, issue.problem]), [['card', 'secrets/broken', 'invalid-batch-file']]);
await rm(path.dirname(brokenFile), { recursive: true, force: true });
assert.equal(cli('stats', deckDir, '--write').code, 0);
assert.equal(groundCheck().code, 0);

// --- An entry file on disk but not yet in files[] is flagged, not skipped ---
const unlistedFile = path.join(deckDir, 'secrets', 'unlisted.json');
await mkdir(path.dirname(unlistedFile), { recursive: true });
await writeFile(unlistedFile, JSON.stringify({ entries: [{ id: 'canon.secret.unlisted', title: 'Unlisted' }] }));
const unlisted = groundCheck();
assert.equal(unlisted.code, 1, 'An unlisted entry file must not pass silently.');
assert.deepEqual(unlisted.report.issues.map(issue => [issue.batch, issue.problem]), [['secrets/unlisted', 'invalid-batch-file']]);
assert.match(unlisted.report.issues[0].detail, /not listed in the manifest's files\[\]; run stats --write/);
await rm(path.dirname(unlistedFile), { recursive: true, force: true });

// --- A bare-array entry file is read like Pack Health reads it ---
const arrayFile = path.join(deckDir, 'secrets', 'array.json');
await mkdir(path.dirname(arrayFile), { recursive: true });
await writeFile(arrayFile, JSON.stringify([{ id: 'canon.secret.array', title: 'Array card' }]));
assert.equal(cli('stats', deckDir, '--write').code, 0);
const arrayRun = groundCheck();
assert.deepEqual(arrayRun.report.issues.map(issue => [issue.itemId, issue.problem]), [['canon.secret.array', 'missing-support']]);
await rm(path.dirname(arrayFile), { recursive: true, force: true });
assert.equal(cli('stats', deckDir, '--write').code, 0);
assert.equal(groundCheck().code, 0);

// --- report --stage cards shows each claim next to its pointed-at facts, and never blocks ---
const reportCards = cleanCards();
reportCards[0].sourceInfo.evidenceFacts = ['chapters/canon-ch-01#0', 'chapters/canon-ch-01#1'];
reportCards[1].sourceInfo.evidenceFacts = ['chapters/canon-ch-14#5'];
await writeCards(reportCards);
const reportRun = cli('report', projectId, '--stage', 'cards', '--json');
assert.equal(reportRun.code, 0, reportRun.stderr);
const reportJson = JSON.parse(reportRun.stdout);
assert.equal(reportJson.groundingIssues, 1);
assert.equal(reportJson.duplicates, 0, 'Existing duplicate check is unchanged.');
assert.equal(reportJson.unbacked, 0, 'Existing unbacked check is unchanged.');
assert.equal(reportJson.crossDeckCitations, 0, 'Existing cross-deck check is unchanged.');
const markdown = await readFile(path.join(projectDir, 'reviews', 'cards.md'), 'utf8');
assert.ok(markdown.includes('### Claims and supporting facts'));
const maraRow = markdown.split('\n').find(line => line.startsWith('| canon.character.mara-venn | characters/main_cast |'));
assert.ok(maraRow, 'Cards artifact should have a grounding row per card.');
assert.ok(maraRow.includes(reportCards[0].content.fact), 'Row should carry content.fact.');
assert.ok(maraRow.includes(reportCards[0].content.injection), 'Row should carry content.injection.');
assert.ok(maraRow.includes(FACT_MARA) && maraRow.includes(FACT_RAVENHOLD), 'Row should inline every supporting fact string.');
assert.ok(maraRow.includes('`chapters/canon-ch-01#1`'), 'Facts should be labelled with their pointer.');
const setheRow = markdown.split('\n').find(line => line.startsWith('| canon.secret.sethe-ashen-pact | characters/main_cast |'));
assert.ok(setheRow.includes('fact-out-of-range'), 'Unresolvable pointers should show their problem inline.');
assert.ok(markdown.includes('## Grounding issues'));
assert.ok(markdown.includes('## Duplicate card ids') && markdown.includes('## Cards without accepted evidence backing') && markdown.includes('## Cross-deck evidence citations'));
const reportText = cli('report', projectId, '--stage', 'cards');
assert.equal(reportText.code, 0);
assert.ok(reportText.stdout.includes('ground check --stage cards'), reportText.stdout);

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck ground check (cards) tests passed.');
