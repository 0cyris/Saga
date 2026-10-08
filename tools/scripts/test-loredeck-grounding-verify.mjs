/**
 * test-loredeck-grounding-verify.mjs -- Saga
 * Exercises the grounding checker for title batches: `brief --role
 * grounding-verify --batch B` renders a clean-context prompt (batch path,
 * sorted cited evidence files, pointer reading, verdicts, findings shape,
 * return contract), resolves a batch by file name or by batchId, rejects an
 * unknown batch, reports card batches as not yet supported, and
 * `report --stage titles` summarizes findings files when present while
 * staying byte-identical when none exist.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GROUNDING_VERDICTS } from '../loredeck/lib/briefs.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-grounding-verify');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectId = 'verify-canon';
const deckId = 'verify-core';
const projectDir = path.join(workshopRoot, projectId);
const batchDir = path.join(projectDir, 'plans', 'title-batches', deckId);
const auditDir = path.join(projectDir, 'reviews', 'audit');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function evidence(scope, records) {
    return {
        schemaVersion: 1,
        scope,
        deckId: '',
        sourceKind: 'user_supplied',
        provenance: { url: '', title: 'Reader notes', retrievedAt: '2026-10-08' },
        records,
        failures: [],
    };
}

async function writeJson(file, json) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(json, null, 2)}\n`);
}

await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', projectId, '--title', 'Verify Canon', '--size', 'family', '--decks', `${deckId}:core,verify-era:era`).code, 0);

const DRAFTING_NOTE = 'ORCHESTRATOR-ONLY drafting rationale: picked these titles because the user liked Mara.';
await writeJson(path.join(projectDir, 'evidence', 'places', 'places.json'), evidence('places', [
    { id: 'canon-place-ravenhold', title: 'Ravenhold', facts: ['Ravenhold Keep is a mountain garrison.'] },
]));
await writeJson(path.join(projectDir, 'evidence', 'chapters', 'chapters.json'), evidence('chapters', [
    { id: 'canon-ch-01', title: 'Chapter 1', facts: ['Mara Venn is a 17-year-old conscript.', 'Ravenhold is held by the Warden\'s Order.'] },
    { id: 'canon-ch-14', title: 'Chapter 14', facts: ['Warden Sethe is revealed to have sworn to the Ashen Pact.'] },
]));
await writeJson(path.join(projectDir, 'evidence', 'unrelated', 'unrelated.json'), evidence('unrelated', [
    { id: 'other', title: 'Not cited', facts: ['Nothing here is cited.'] },
]));
await writeJson(path.join(batchDir, 'batch-1.json'), {
    batchId: 'batch-1',
    deckId,
    notes: DRAFTING_NOTE,
    titles: [
        {
            id: 'canon.character.mara-venn',
            title: 'Mara Venn',
            category: 'character',
            gateIntent: 'Eligible from the opening; Mara is a 17-year-old conscript.',
            evidenceRefs: ['chapters/canon-ch-01'],
            support: ['chapters/canon-ch-01#0'],
        },
        {
            id: 'canon.location.ravenhold-keep',
            title: 'Ravenhold Keep',
            category: 'location',
            gateIntent: 'Eligible whenever Ravenhold is in scene.',
            evidenceRefs: ['places/canon-place-ravenhold', 'chapters/canon-ch-01'],
            support: ['places/canon-place-ravenhold#0', 'chapters/canon-ch-01#1', 'ghosts/missing-record#0'],
        },
    ],
});
// A second batch whose file name differs from its batchId.
await writeJson(path.join(batchDir, 'second.json'), {
    batchId: 'batch-2',
    deckId,
    titles: [{
        id: 'canon.secret.sethe-ashen-pact',
        title: 'Sethe\'s oath',
        category: 'secret',
        gateIntent: 'Only eligible after Chapter 14.',
        evidenceRefs: ['chapters/canon-ch-14'],
        support: ['chapters/canon-ch-14#0'],
    }],
});

// --- Render: a clean-context prompt for one title batch ---
const rendered = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1');
assert.equal(rendered.code, 0, rendered.stderr);
const prompt = rendered.stdout;
assert.ok(prompt.includes(path.join(batchDir, 'batch-1.json')), 'The batch file path should be given.');
const chaptersPath = path.join(projectDir, 'evidence', 'chapters', 'chapters.json');
const placesPath = path.join(projectDir, 'evidence', 'places', 'places.json');
assert.ok(prompt.includes(chaptersPath) && prompt.includes(placesPath), 'Every cited evidence file should be listed.');
assert.ok(prompt.indexOf(chaptersPath) < prompt.indexOf(placesPath), 'Evidence files should be sorted.');
assert.equal(prompt.split(chaptersPath).length - 1, 1, 'Evidence files should be deduplicated.');
assert.ok(!prompt.includes('unrelated.json'), 'Uncited evidence files should be left out.');
assert.ok(prompt.includes('`ghosts/missing-record`'), 'A cited record missing from the evidence should be named.');
assert.ok(prompt.includes('0-based index'), 'The prompt should explain how to read a pointer.');
for (const verdict of GROUNDING_VERDICTS) {
    assert.ok(prompt.includes(`\`${verdict}\``), `The prompt should define verdict ${verdict}.`);
}
assert.ok(prompt.includes(path.join(auditDir, `${deckId}-titles-batch-1.json`)), 'The findings file path should be given.');
assert.ok(prompt.includes(`reviews/audit/${deckId}-titles-batch-1.json`), 'The project-relative findings path should be given.');
assert.ok(prompt.includes('"role": "grounding-verify"') && prompt.includes(`"target": "plans/title-batches/${deckId}/batch-1.json"`),
    'The findings file shape should be shown.');
assert.ok(prompt.includes('`canon.character.mara-venn`') && prompt.includes('`canon.location.ravenhold-keep`'), 'Title ids should be listed.');
assert.ok(/note[^\n]*required[^\n]*quote/i.test(prompt), 'A note quoting fact text should be required for non-entailed verdicts.');
assert.ok(/read-only/i.test(prompt), 'The prompt should say the checker is read-only.');
assert.ok(/nothing you know or remember/i.test(prompt), 'The prompt should forbid judging from memory.');
assert.ok(prompt.includes('## Return format'), 'The return contract should be appended.');
assert.ok(prompt.includes(`{"status":"ok","wrote":["reviews/audit/${deckId}-titles-batch-1.json"],"counts":{"titles":2,"flagged":0},"gaps":[],"flags":[]}`),
    'The return contract example should carry the findings path and counts.');
assert.ok(!prompt.includes(DRAFTING_NOTE) && !prompt.includes('ORCHESTRATOR-ONLY'), 'No drafting commentary may reach the checker.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(prompt), 'No unresolved placeholders should remain.');
assert.ok(!prompt.includes('<!--'), 'Maintainer comments should be stripped.');

const again = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1');
assert.equal(again.stdout, prompt, 'Output should be byte-identical for identical project state.');

const asJson = JSON.parse(cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1', '--json').stdout);
assert.equal(asJson.role, 'grounding-verify');
assert.equal(asJson.batch, 'batch-1');
assert.equal(asJson.output, `reviews/audit/${deckId}-titles-batch-1.json`);

// A batch can be named by its batchId when the file name differs.
const byId = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-2');
assert.equal(byId.code, 0, byId.stderr);
assert.ok(byId.stdout.includes(path.join(batchDir, 'second.json')), 'batchId lookup should find second.json.');
assert.ok(byId.stdout.includes(`reviews/audit/${deckId}-titles-batch-2.json`));
assert.ok(byId.stdout.includes('Every record the batch cites is in one of the files above.'));

// --- Errors ---
const unknownBatch = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-9');
assert.equal(unknownBatch.code, 1);
assert.match(unknownBatch.stderr, /Unknown title batch "batch-9" for deck verify-core\. Batches under plans\/title-batches\/verify-core\/: batch-1, batch-2\./);

const otherDeck = cli('brief', projectId, '--role', 'grounding-verify', '--deck', 'verify-era', '--batch', 'batch-1');
assert.equal(otherDeck.code, 1);
assert.match(otherDeck.stderr, /No title batches found under plans\/title-batches\/verify-era\//);

const cards = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters');
assert.equal(cards.code, 1);
assert.match(cards.stderr, /card batches .* not yet supported/);

const neither = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId);
assert.equal(neither.code, 1);
assert.match(neither.stderr, /requires --batch/);

const scoped = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1', '--scope', 'chapters');
assert.equal(scoped.code, 1);
assert.match(scoped.stderr, /does not take --scope/);

const traversal = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', '../batch-1');
assert.equal(traversal.code, 1);
assert.match(traversal.stderr, /Invalid --batch/);

// --- The agent file defers to the role template ---
const agentFile = await readFile(path.join(repoRoot, '.claude', 'agents', 'loredeck-grounding-verifier.md'), 'utf8');
assert.match(agentFile, /^---\nname: loredeck-grounding-verifier\n/);
assert.match(agentFile, /\ntools: Read, Grep, Glob, Write\n/);
assert.match(agentFile, /\nmodel: inherit\n/);
assert.ok(agentFile.includes('--role grounding-verify'), 'The agent file should point at the rendered brief.');

// --- Report: unchanged without findings, summarized with them ---
const titlesArtifact = path.join(projectDir, 'reviews', 'titles.md');
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
const baseline = await readFile(titlesArtifact, 'utf8');
assert.ok(!baseline.includes('Grounding checker findings'));

// An empty audit folder, or findings for another stage, change nothing.
await mkdir(auditDir, { recursive: true });
await writeJson(path.join(auditDir, 'evidence-chapters.json'), {
    schemaVersion: 1, role: 'evidence-audit', target: 'evidence/chapters/chapters.json', findings: [{ ref: 'chapters/canon-ch-01#0', verdict: 'unsupported', note: 'x' }],
});
await writeJson(path.join(auditDir, `${deckId}-cards-characters.json`), {
    schemaVersion: 1, role: 'grounding-verify', target: 'drafts/x.json', findings: [{ ref: 'c', verdict: 'unsupported', note: 'x' }],
});
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
assert.equal(await readFile(titlesArtifact, 'utf8'), baseline, 'Without titles findings the artifact must be byte-identical.');

await writeJson(path.join(auditDir, `${deckId}-titles-batch-1.json`), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `plans/title-batches/${deckId}/batch-1.json`,
    findings: [
        { ref: 'canon.character.mara-venn', verdict: 'entailed', note: '' },
        { ref: 'canon.location.ravenhold-keep', verdict: 'partial', note: 'places/canon-place-ravenhold#0 says "Ravenhold Keep is a mountain garrison." Nothing backs ghosts/missing-record.' },
    ],
});
await writeJson(path.join(auditDir, 'verify-era-titles-batch-1.json'), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: 'plans/title-batches/verify-era/batch-1.json',
    findings: [{ ref: 'era.title', verdict: 'timing-mismatch', note: 'Fact places it in chapter 3.' }],
});
const withFindings = cli('report', projectId, '--stage', 'titles');
assert.equal(withFindings.code, 0, withFindings.stderr);
const summarized = await readFile(titlesArtifact, 'utf8');
const [heading] = baseline.split('\n');
assert.ok(summarized.startsWith(`${heading}\n\n## Grounding checker findings\n\n1 verified, 2 flagged across 2 findings file(s).`),
    `The findings summary should sit at the top of the artifact:\n${summarized.slice(0, 400)}`);
assert.ok(summarized.includes('| canon.location.ravenhold-keep | partial |'), 'Flagged findings should be listed.');
assert.ok(summarized.includes('| era.title | timing-mismatch |'), 'Findings from every deck should be summarized.');
assert.ok(!summarized.includes('| c | unsupported |'), 'Card findings stay out of the titles artifact.');
assert.ok(summarized.endsWith(baseline.slice(heading.length + 2)), 'The rest of the artifact should be unchanged.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck grounding-verify tests passed.');
