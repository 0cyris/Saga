/**
 * test-loredeck-brief.mjs -- Saga
 * Exercises `loredeck brief`: the research role renders a self-contained
 * prompt (scope brief, verbatim evidence template, authoringSignals
 * vocabulary, output path, source policy, return contract), output is
 * deterministic for identical project state, and missing-scope / unknown-role
 * / unknown-deck errors are clear.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderTemplate } from '../loredeck/lib/briefs.mjs';
import { EVIDENCE_AUTHORING_SIGNALS } from '../loredeck/lib/evidence-store.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-brief');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const skillDir = path.join(repoRoot, '.claude', 'skills', 'loredeck-builder');
const projectDir = path.join(workshopRoot, 'brief-canon');

function cli(...args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
        encoding: 'utf8',
    });
    return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

await rm(workshopRoot, { recursive: true, force: true });
assert.equal(cli('init', 'brief-canon', '--title', 'Brief Canon', '--size', 'family', '--decks', 'brief-core:core,brief-book1:era').code, 0);

const scopeBrief = `# Scope Brief: Brief Canon

## Fandom and source range

Covers the Brief Canon novels, books 1-2. Template braces like {{notAPlaceholder}} pass through literally.

## Continuity and canon tier

Continuity id: brief-novels. Primary canon only.

## Deck split

Family: brief-core (core) and brief-book1 (era).

## Story-coordinate model

Book and chapter, in reading order.

## Spoiler philosophy

Gate every reveal to the chapter that confirms it.

## Assumptions and risks

None yet.
`;
await mkdir(path.join(projectDir, 'brief'), { recursive: true });
await writeFile(path.join(projectDir, 'brief', 'scope-brief.md'), scopeBrief);

// --- Rendering: the research brief is self-contained ---
const rendered = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(rendered.code, 0, rendered.stderr);
const prompt = rendered.stdout;

assert.ok(prompt.includes(scopeBrief.trim()), 'The scope brief should be inlined in full.');
const evidenceTemplate = (await readFile(path.join(skillDir, 'templates', 'evidence-file.json'), 'utf8')).trimEnd();
assert.ok(prompt.includes(evidenceTemplate), 'templates/evidence-file.json should appear word for word.');
for (const signal of EVIDENCE_AUTHORING_SIGNALS) {
    assert.ok(prompt.includes(`\`${signal}\``), `authoringSignals vocabulary should list ${signal}.`);
}
assert.ok(prompt.includes('evidence/chapters/chapters.json'), 'Output path should default to evidence/<scope>/<scope>.json.');
assert.ok(prompt.includes(path.join(projectDir, 'evidence', 'chapters', 'chapters.json')), 'Absolute output path should be given.');
assert.ok(prompt.includes('## Source policy'), 'Source policy section should render.');
assert.ok(prompt.includes('brief-core'), 'Deck id should render.');
assert.ok(prompt.includes('## Return format'), 'Return contract should be appended.');
assert.ok(prompt.includes('{"status":"ok","wrote":["evidence/chapters/chapters.json"],"counts":{"records":12},"gaps":[],"flags":[]}'),
    'Return contract example should carry the research counts and output path.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(prompt.replace('{{notAPlaceholder}}', '')), 'No unresolved placeholders should remain.');
assert.ok(!prompt.includes('<!--'), 'Maintainer comments should be stripped.');
assert.ok(!/encounters/i.test(prompt), 'Orchestrator-only anti-example history must not reach the subagent.');

// The pipeline doc and the CLI must agree on the vocabulary.
const pipelineDoc = await readFile(path.join(skillDir, 'references', 'evidence-pipeline.md'), 'utf8');
for (const signal of EVIDENCE_AUTHORING_SIGNALS) {
    assert.ok(pipelineDoc.includes(`\`${signal}\``), `evidence-pipeline.md should list authoringSignal ${signal}.`);
}

// --- Determinism: identical project state, identical output ---
const again = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(again.stdout, prompt, 'Output should be byte-identical for identical project state.');

// --- --out writes the same prompt; --json wraps it ---
const outFile = path.join(workshopRoot, 'out', 'research-chapters.md');
const toFile = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters', '--out', outFile);
assert.equal(toFile.code, 0, toFile.stderr);
assert.equal(await readFile(outFile, 'utf8'), prompt, '--out should write the identical prompt.');
const asJson = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters', '--json');
assert.equal(asJson.code, 0, asJson.stderr);
const json = JSON.parse(asJson.stdout);
assert.equal(json.role, 'research');
assert.equal(json.scope, 'chapters');
assert.equal(json.output, 'evidence/chapters/chapters.json');
assert.equal(json.prompt, prompt);

// --- --file names the output; existing ids in the scope are listed, sorted ---
await mkdir(path.join(projectDir, 'evidence', 'chapters'), { recursive: true });
await writeFile(path.join(projectDir, 'evidence', 'chapters', 'chapters-01-05.json'), JSON.stringify({
    schemaVersion: 1,
    scope: 'chapters',
    deckId: '',
    sourceKind: 'user_supplied',
    provenance: { url: '', title: 'Notes', retrievedAt: '2026-10-01' },
    records: [
        { id: 'bc-ch-02', title: 'Chapter 2', facts: ['A fact.'] },
        { id: 'bc-ch-01', title: 'Chapter 1', facts: ['A fact.'] },
    ],
    failures: [],
}, null, 2));
const second = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-book1', '--scope', 'chapters', '--file', 'chapters-06-10');
assert.equal(second.code, 0, second.stderr);
assert.ok(second.stdout.includes('evidence/chapters/chapters-06-10.json'), '--file should set the output file name.');
assert.ok(second.stdout.indexOf('`bc-ch-01`') < second.stdout.indexOf('`bc-ch-02`'), 'Used record ids should be listed in sorted order.');
const redispatch = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters', '--file', 'chapters-01-05');
assert.ok(!redispatch.stdout.includes('`bc-ch-01`'), 'Re-dispatching a file should not list that file\'s own ids as taken.');

// --- Errors ---
const noScope = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core');
assert.equal(noScope.code, 1);
assert.match(noScope.stderr, /requires --scope/);

const unknownRole = cli('brief', 'brief-canon', '--role', 'bogus', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(unknownRole.code, 1);
assert.match(unknownRole.stderr, /Unknown role "bogus"\. Available roles: /);
for (const inherited of ['toString', 'constructor', '__proto__']) {
    const result = cli('brief', 'brief-canon', '--role', inherited, '--deck', 'brief-core', '--scope', 'chapters');
    assert.equal(result.code, 1, `${inherited} should be an unknown role.`);
    assert.match(result.stderr, /Unknown role/, `${inherited}: ${result.stderr}`);
}

// --- Assignment: defaults to the whole scope; --assignment narrows it ---
assert.ok(prompt.includes('Research the whole `chapters` scope, as the scope brief defines it.'), 'Default assignment should cover the whole scope.');
const narrowed = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters', '--file', 'chapters-06-10', '--assignment', 'chapters 6 to 10 of book 1');
assert.equal(narrowed.code, 0, narrowed.stderr);
assert.ok(narrowed.stdout.includes('Research chapters 6 to 10 of book 1.'), 'A narrowed assignment should be rendered verbatim.');

const noRole = cli('brief', 'brief-canon', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(noRole.code, 1);
assert.match(noRole.stderr, /--role is required\. Available roles: [^\n]*\bresearch\b/);
assert.match(noRole.stderr, /Available roles: [^\n]*\bgrounding-verify\b/);

const unknownDeck = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'nope', '--scope', 'chapters');
assert.equal(unknownDeck.code, 1);
assert.match(unknownDeck.stderr, /Unknown deck id "nope"/);

const wrongSelector = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters', '--batch', 'batch-1');
assert.equal(wrongSelector.code, 1);
assert.match(wrongSelector.stderr, /does not take --batch/);

await writeFile(path.join(projectDir, 'brief', 'scope-brief.md'), '# Scope Brief\n\n## Fandom and source range\n\n*What canon is covered.*\n');
const placeholderBrief = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(placeholderBrief.code, 1);
assert.match(placeholderBrief.stderr, /scope-brief\.md is not complete/);

await rm(path.join(projectDir, 'brief', 'scope-brief.md'));
const noBrief = cli('brief', 'brief-canon', '--role', 'research', '--deck', 'brief-core', '--scope', 'chapters');
assert.equal(noBrief.code, 1);
assert.match(noBrief.stderr, /No scope brief found/);

// --- Template renderer: unresolved placeholders fail ---
assert.equal(renderTemplate('a {{x}} b', { x: '{{y}}' }), 'a {{y}} b', 'Substituted values are not re-scanned.');
assert.throws(() => renderTemplate('{{x}} {{missing}}', { x: 1 }, { label: 'demo' }), /Unresolved placeholder\(s\) in demo: missing/);

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck brief tests passed.');
