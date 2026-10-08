/**
 * test-loredeck-evidence-audit.mjs -- Saga
 * Exercises the evidence checker (ticket #10): `brief --role evidence-audit`
 * renders a self-contained prompt for one evidence file (path, scope brief,
 * provenance-based source instruction, findings shape, verdicts, read-only
 * rule, return contract), refuses a missing evidence file, and the evidence
 * review artifact summarizes reviews/audit/evidence-*.json findings when
 * present and is byte-identical to the plain artifact when they are absent.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EVIDENCE_AUDIT_VERDICTS, evidenceAuditOutputRel } from '../loredeck/lib/briefs.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-evidence-audit');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectDir = path.join(workshopRoot, 'audit-canon');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', 'audit-canon', '--title', 'Audit Canon', '--decks', 'audit-core:core').code, 0);

const sections = ['Fandom and source range', 'Continuity and canon tier', 'Deck split', 'Story-coordinate model', 'Spoiler philosophy', 'Assumptions and risks'];
const scopeBrief = `# Scope Brief: Audit Canon\n\n${sections.map(name => `## ${name}\n\nFilled in for the evidence audit test.\n`).join('\n')}`;
await mkdir(path.join(projectDir, 'brief'), { recursive: true });
await writeFile(path.join(projectDir, 'brief', 'scope-brief.md'), scopeBrief);

const evidence = {
    schemaVersion: 1,
    scope: 'chapters',
    deckId: '',
    sourceKind: 'web',
    provenance: { url: 'https://example.fandom.com/wiki/Chapter_1', title: 'Chapter 1', retrievedAt: '2026-10-01' },
    records: [
        { id: 'ac-ch-01', title: 'Chapter 1', inUniverseSpan: 'Chapter 1', keyEntities: ['Ava'], authoringSignals: ['timeline-anchor'], facts: ['Ava arrives in the city.', 'Ava meets the warden.'], quotesOrRefs: ['Chapter 1'] },
        { id: 'ac-ch-02', title: 'Chapter 2', inUniverseSpan: 'Chapter 2', keyEntities: ['Ava'], authoringSignals: ['timeline-anchor'], facts: ['Ava leaves the city.'], quotesOrRefs: ['Chapter 2'] },
    ],
    failures: [],
};
await mkdir(path.join(projectDir, 'evidence', 'chapters'), { recursive: true });
await writeFile(path.join(projectDir, 'evidence', 'chapters', 'chapters.json'), JSON.stringify(evidence, null, 2));

// --- Render: the evidence-audit brief is self-contained ---
const rendered = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'chapters');
assert.equal(rendered.code, 0, rendered.stderr);
const prompt = rendered.stdout;
assert.ok(prompt.includes(path.join(projectDir, 'evidence', 'chapters', 'chapters.json')), 'The evidence file path should be given.');
assert.ok(prompt.includes('`evidence/chapters/chapters.json`'), 'The project-relative evidence path should be given.');
assert.ok(prompt.includes(scopeBrief.trim()), 'The scope brief should be inlined in full.');
assert.ok(prompt.includes('<https://example.fandom.com/wiki/Chapter_1>'), 'The provenance URL should be named as the source to re-read.');
assert.ok(prompt.includes('2 record(s) holding 3 fact(s)'), 'The record and fact counts should render.');
assert.ok(prompt.includes('reviews/audit/evidence-chapters.json'), 'Findings default to reviews/audit/evidence-<scope>.json.');
assert.ok(prompt.includes(path.join(projectDir, 'reviews', 'audit', 'evidence-chapters.json')), 'The absolute findings path should be given.');
assert.ok(prompt.includes('"role": "evidence-audit"') && prompt.includes('"target": "evidence/chapters/chapters.json"'), 'The findings shape should render with role and target.');
assert.ok(prompt.includes('chapters/<recordId>#<factIndex>'), 'Finding refs use <scope>/<recordId>#<factIndex>.');
for (const verdict of EVIDENCE_AUDIT_VERDICTS) {
    assert.ok(prompt.includes(`\`${verdict}\``), `Verdict ${verdict} should be listed.`);
}
assert.ok(/A note is required for every verdict other than `supported`/.test(prompt), 'Notes are required for non-supported verdicts.');
assert.ok(prompt.includes('## Read-only rule') && prompt.includes('The findings file is the only file you write.'), 'The read-only rule should render.');
assert.ok(prompt.includes('truncated-source:<url>') && prompt.includes('noisy-extraction:evidence/chapters/chapters.json'), 'Truncation and extraction-noise flags should render.');
assert.ok(prompt.includes('## Return format'), 'The return contract should be appended.');
assert.ok(prompt.includes('{"status":"ok","wrote":["reviews/audit/evidence-chapters.json"],"counts":{"facts":12,"flagged":2},"gaps":[],"flags":[]}'),
    'The return contract example should carry the findings path and audit counts.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(prompt), 'No unresolved placeholders should remain.');
assert.ok(!prompt.includes('<!--'), 'Maintainer comments should be stripped.');
assert.equal(cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'chapters').stdout, prompt, 'Output should be deterministic.');

// --- --file: a differently named file gets its own findings file ---
await writeFile(path.join(projectDir, 'evidence', 'chapters', 'chapters-06-10.json'), JSON.stringify({
    ...evidence,
    sourceKind: 'user_supplied',
    provenance: { url: '', title: 'User notes, chapters 6-10', retrievedAt: '2026-10-01' },
    records: [{ ...evidence.records[0], id: 'ac-ch-06' }],
}, null, 2));
const split = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'chapters', '--file', 'chapters-06-10', '--json');
assert.equal(split.code, 0, split.stderr);
const splitJson = JSON.parse(split.stdout);
assert.equal(splitJson.output, 'reviews/audit/evidence-chapters-chapters-06-10.json');
assert.equal(evidenceAuditOutputRel('chapters', 'chapters'), 'reviews/audit/evidence-chapters.json');
assert.ok(splitJson.prompt.includes('`"user_supplied"` (source: User notes, chapters 6-10)'), 'user_supplied files should point at the task note for source text.');
assert.ok(splitJson.prompt.includes('task note'), 'user_supplied source instruction should mention the task note.');

// --- Errors ---
const missingFile = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'chapters', '--file', 'nope');
assert.equal(missingFile.code, 1);
assert.match(missingFile.stderr, /No evidence file at evidence\/chapters\/nope\.json/);
const missingScope = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'places');
assert.equal(missingScope.code, 1);
assert.match(missingScope.stderr, /No evidence file at evidence\/places\/places\.json/);
const noScope = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core');
assert.equal(noScope.code, 1);
assert.match(noScope.stderr, /requires --scope/);
const noAssignment = cli('brief', 'audit-canon', '--role', 'evidence-audit', '--deck', 'audit-core', '--scope', 'chapters', '--assignment', 'x');
assert.equal(noAssignment.code, 1);
assert.match(noAssignment.stderr, /does not take --assignment/);

// --- Evidence review artifact: absent findings leave it unchanged ---
const evidenceMd = path.join(projectDir, 'reviews', 'evidence.md');
const validateBefore = cli('evidence', 'validate', 'audit-canon');
assert.equal(validateBefore.code, 0, validateBefore.stdout + validateBefore.stderr);
const baseline = await readFile(evidenceMd, 'utf8');
assert.ok(baseline.startsWith('# Evidence Review: Audit Canon\n\n## Files\n'), 'With no findings the artifact starts with the file table, as before.');
assert.ok(!baseline.includes('Evidence checker findings'));
assert.equal(cli('report', 'audit-canon', '--stage', 'evidence').code, 0);
assert.equal(await readFile(evidenceMd, 'utf8'), baseline, 'report --stage evidence should match evidence validate.');

// A non-evidence findings file (e.g. a grounding verifier's) does not change the evidence page.
const auditDir = path.join(projectDir, 'reviews', 'audit');
await mkdir(auditDir, { recursive: true });
await writeFile(path.join(auditDir, 'audit-core-titles-batch-1.json'), JSON.stringify({
    schemaVersion: 1, role: 'grounding-verify', target: 'plans/title-batches/audit-core/batch-1.json',
    findings: [{ ref: 'audit-core.title-1', verdict: 'unsupported', note: 'x' }],
}));
assert.equal(cli('report', 'audit-canon', '--stage', 'evidence').code, 0);
assert.equal(await readFile(evidenceMd, 'utf8'), baseline, 'Grounding findings should not reach the evidence page.');

// --- Present findings are summarized at the top ---
await writeFile(path.join(auditDir, 'evidence-chapters.json'), JSON.stringify({
    schemaVersion: 1,
    role: 'evidence-audit',
    target: 'evidence/chapters/chapters.json',
    findings: [
        { ref: 'chapters/ac-ch-01#0', verdict: 'supported', note: '' },
        { ref: 'chapters/ac-ch-01#1', verdict: 'unsupported', note: 'The source has Ava meet the warden in chapter 3.' },
        { ref: 'chapters/ac-ch-02#0', verdict: 'out-of-scope', note: 'Book 2 event; the scope brief covers book 1 only.' },
    ],
}, null, 2));
const validateAfter = cli('evidence', 'validate', 'audit-canon');
assert.equal(validateAfter.code, 0, 'Findings never block evidence validate.');
const withFindings = await readFile(evidenceMd, 'utf8');
assert.ok(withFindings.startsWith('# Evidence Review: Audit Canon\n\n## Evidence checker findings\n'), 'The summary should sit at the top of the page.');
assert.ok(withFindings.includes('1 verified, 2 flagged across 1 findings file(s).'));
assert.ok(withFindings.includes('| chapters/ac-ch-01#1 | unsupported | The source has Ava meet the warden in chapter 3. | reviews/audit/evidence-chapters.json |'));
assert.ok(withFindings.includes('| chapters/ac-ch-02#0 | out-of-scope |'));
assert.ok(!withFindings.includes('chapters/ac-ch-01#0 |'), 'Supported findings are counted, not listed.');
assert.ok(withFindings.endsWith(baseline.slice('# Evidence Review: Audit Canon\n\n'.length)), 'The rest of the page is unchanged.');
assert.equal(cli('report', 'audit-canon', '--stage', 'evidence').code, 0);
assert.equal(await readFile(evidenceMd, 'utf8'), withFindings, 'report --stage evidence renders the same summary.');

// Removing the findings restores the byte-identical page.
await rm(path.join(auditDir, 'evidence-chapters.json'));
assert.equal(cli('report', 'audit-canon', '--stage', 'evidence').code, 0);
assert.equal(await readFile(evidenceMd, 'utf8'), baseline, 'Without evidence findings the artifact is byte-identical.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck evidence audit tests passed.');
