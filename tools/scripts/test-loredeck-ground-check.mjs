/**
 * test-loredeck-ground-check.mjs -- Saga
 * Exercises fact-level grounding for title batches: `ground check --stage
 * titles` must pass a clean batch and flag each failure class (missing or
 * empty support, unknown / unaccepted record, out-of-range fact index,
 * malformed pointer, pointer outside evidenceRefs), and `report --stage
 * titles` must show each gateIntent next to the facts it points at.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFactPointer } from '../loredeck/lib/grounding.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-ground-check');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectId = 'ground-canon';
const projectDir = path.join(workshopRoot, projectId);
const batchDir = path.join(projectDir, 'plans', 'title-batches', projectId);
const batchPath = path.join(batchDir, 'batch-1.json');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function groundCheck() {
    const result = cli('ground', 'check', projectId, '--stage', 'titles', '--json');
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
        { id: 'canon-ch-14', title: 'Chapter 14', facts: [FACT_PACT] },
        { id: 'canon-ch-20', title: 'Chapter 20 (still pending review)', facts: ['Pending fact.'] },
    ],
    failures: [],
};

function cleanTitles() {
    return [
        {
            id: 'canon.character.mara-venn',
            title: 'Mara Venn - conscript recruit',
            category: 'character',
            gateIntent: 'Eligible from the opening; Mara is an untrained 17-year-old conscript.',
            evidenceRefs: ['chapters/canon-ch-01'],
            support: ['chapters/canon-ch-01#0'],
        },
        {
            id: 'canon.secret.sethe-ashen-pact',
            title: 'Warden Sethe\'s secret oath to the Ashen Pact',
            category: 'secret',
            gateIntent: 'Hard-gated reveal: Sethe swore to the Ashen Pact before Book 1.',
            evidenceRefs: ['chapters/canon-ch-14'],
            support: ['chapters/canon-ch-14#0'],
        },
    ];
}

async function writeBatch(titles) {
    await writeFile(batchPath, `${JSON.stringify({ batchId: 'batch-1', deckId: projectId, titles }, null, 2)}\n`);
}

// --- Pointer parsing (unit level) ---
assert.deepEqual(parseFactPointer('chapters/canon-ch-01#0'), { ok: true, scope: 'chapters', recordId: 'canon-ch-01', factIndex: 0, key: 'chapters/canon-ch-01' });
for (const bad of ['chapters/canon-ch-01', 'chapters/canon-ch-01#', 'chapters/canon-ch-01#-1', 'chapters/canon-ch-01#01', 'chapters/canon-ch-01#1.5', 'canon-ch-01#0', 'Chapters/x#0', '', 7, null]) {
    assert.equal(parseFactPointer(bad).ok, false, `Expected ${JSON.stringify(bad)} to be malformed.`);
}

// --- Project setup ---
await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', projectId, '--title', 'Ground Canon').code, 0);
await mkdir(path.join(projectDir, 'evidence'), { recursive: true });
await writeFile(path.join(projectDir, 'evidence', 'chapters.json'), `${JSON.stringify(evidenceFile, null, 2)}\n`);
const accept = cli('evidence', 'accept', projectId, '--scope', 'chapters', '--ids', 'canon-ch-01,canon-ch-14');
assert.equal(accept.code, 0, accept.stderr || accept.stdout);
await mkdir(batchDir, { recursive: true });

// --- Clean batch passes ---
await writeBatch(cleanTitles());
const clean = groundCheck();
assert.equal(clean.code, 0, JSON.stringify(clean.report));
assert.equal(clean.report.ok, true);
assert.equal(clean.report.checked, 2);
assert.deepEqual(clean.report.issues, []);
const cleanText = cli('ground', 'check', projectId, '--stage', 'titles');
assert.equal(cleanText.code, 0, cleanText.stderr);
assert.ok(cleanText.stdout.includes('0 issue(s)'));

// --- Each failure class is flagged, with titleId, batch, pointer and problem ---
const cases = [
    { name: 'missing support', mutate: (t) => { delete t.support; }, pointer: null, problem: 'missing-support' },
    { name: 'empty support', mutate: (t) => { t.support = []; }, pointer: null, problem: 'missing-support' },
    { name: 'unknown record', mutate: (t) => { t.support = ['chapters/canon-ch-99#0']; t.evidenceRefs = ['chapters/canon-ch-99']; }, pointer: 'chapters/canon-ch-99#0', problem: 'unknown-record' },
    { name: 'unaccepted record', mutate: (t) => { t.support = ['chapters/canon-ch-20#0']; t.evidenceRefs = ['chapters/canon-ch-20']; }, pointer: 'chapters/canon-ch-20#0', problem: 'unaccepted-record' },
    { name: 'out-of-range fact index', mutate: (t) => { t.support = ['chapters/canon-ch-01#2']; }, pointer: 'chapters/canon-ch-01#2', problem: 'fact-out-of-range' },
    { name: 'malformed pointer', mutate: (t) => { t.support = ['chapters/canon-ch-01:0']; }, pointer: 'chapters/canon-ch-01:0', problem: 'malformed-pointer' },
    { name: 'pointer outside evidenceRefs', mutate: (t) => { t.support = ['chapters/canon-ch-14#0']; }, pointer: 'chapters/canon-ch-14#0', problem: 'not-in-evidence-refs' },
];
for (const testCase of cases) {
    const titles = cleanTitles();
    testCase.mutate(titles[0]);
    await writeBatch(titles);
    const { code, report } = groundCheck();
    assert.equal(code, 1, `${testCase.name}: ground check should exit 1.`);
    assert.equal(report.ok, false, `${testCase.name}: ok should be false.`);
    assert.equal(report.issues.length, 1, `${testCase.name}: expected exactly one issue, got ${JSON.stringify(report.issues)}`);
    const [issue] = report.issues;
    assert.equal(issue.titleId, 'canon.character.mara-venn', `${testCase.name}: titleId`);
    assert.equal(issue.batch, 'batch-1', `${testCase.name}: batch`);
    assert.equal(issue.pointer, testCase.pointer, `${testCase.name}: pointer`);
    assert.equal(issue.problem, testCase.problem, `${testCase.name}: problem`);
}

// --- --stage cards is not supported yet; unknown stage is a usage error ---
const cards = cli('ground', 'check', projectId, '--stage', 'cards', '--json');
assert.equal(cards.code, 1);
assert.ok(cards.stderr.includes('not yet supported'), cards.stderr);
assert.equal(cli('ground', 'check', projectId, '--stage', 'bogus').code, 1);
assert.equal(cli('ground', 'check', projectId, '--stage', 'titles', '--deck', 'nope').code, 1);

// --- report --stage titles shows each claim next to its pointed-at facts ---
const reportTitles = cleanTitles();
reportTitles[0].support = ['chapters/canon-ch-01#0', 'chapters/canon-ch-01#1'];
reportTitles[1].support = ['chapters/canon-ch-14#5'];
await writeBatch(reportTitles);
const reportRun = cli('report', projectId, '--stage', 'titles', '--json');
assert.equal(reportRun.code, 0, reportRun.stderr);
assert.equal(JSON.parse(reportRun.stdout).groundingIssues, 1);
const markdown = await readFile(path.join(projectDir, 'reviews', 'titles.md'), 'utf8');
const maraRow = markdown.split('\n').find(line => line.startsWith('| canon.character.mara-venn |'));
assert.ok(maraRow, 'Titles artifact should have a row per title.');
assert.ok(maraRow.includes(reportTitles[0].gateIntent), 'Row should carry the gateIntent.');
assert.ok(maraRow.includes(FACT_MARA) && maraRow.includes(FACT_RAVENHOLD.replace(/\|/g, '\\|')), 'Row should inline every supporting fact string.');
assert.ok(maraRow.includes('`chapters/canon-ch-01#1`'), 'Facts should be labelled with their pointer.');
const setheRow = markdown.split('\n').find(line => line.startsWith('| canon.secret.sethe-ashen-pact |'));
assert.ok(setheRow.includes('fact-out-of-range'), 'Unresolvable pointers should show their problem inline.');
assert.ok(markdown.includes('## Grounding issues'));
assert.ok(markdown.includes('### Batch `batch-1` (2 titles, status: draft)'));

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck ground check tests passed.');
