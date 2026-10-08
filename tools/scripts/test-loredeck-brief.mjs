/**
 * test-loredeck-brief.mjs -- Saga
 * Exercises `loredeck brief`: the research role renders a self-contained
 * prompt (scope brief, verbatim evidence template, authoringSignals
 * vocabulary, output path, source policy, return contract), output is
 * deterministic for identical project state, and missing-scope / unknown-role
 * / unknown-deck errors are clear. The draft role renders the approved title
 * batch verbatim, read-only registry paths, every cited evidence file (sorted,
 * deduplicated, support-only records included), authoring-rules.md in full,
 * and the output path; unknown and unapproved batches and batch-numbered
 * --file stems are rejected.
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
assert.match(noRole.stderr, /--role is required\. Available roles: draft, research\./);

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

// --- Draft role ---
const writeEvidence = async (scope, file, records) => {
    await mkdir(path.join(projectDir, 'evidence', scope), { recursive: true });
    await writeFile(path.join(projectDir, 'evidence', scope, file), JSON.stringify({
        schemaVersion: 1,
        scope,
        deckId: '',
        sourceKind: 'user_supplied',
        provenance: { url: '', title: 'Notes', retrievedAt: '2026-10-01' },
        records,
        failures: [],
    }, null, 2));
};
await writeEvidence('characters', 'cast.json', [{ id: 'bc-char-mara', title: 'Mara', facts: ['Mara is a recruit.'] }]);
await writeEvidence('places', 'keep.json', [{ id: 'bc-place-keep', title: 'Keep', facts: ['The keep is a garrison.'] }]);
await writeEvidence('lore', 'unrelated.json', [{ id: 'bc-lore-x', title: 'Unrelated', facts: ['Not cited.'] }]);
// Chapter records live in the file written by the research tests above.

const batchDir = path.join(projectDir, 'plans', 'title-batches', 'brief-core');
await mkdir(batchDir, { recursive: true });
const batchText = `{
  "batchId": "batch-1",
  "deckId": "brief-core",
  "titles": [
    {
      "id": "bc.character.mara",
      "title": "Mara - recruit {{notAPlaceholder}}",
      "category": "character",
      "gateIntent": "Eligible from chapter 1.",
      "evidenceRefs": ["chapters/bc-ch-01", "characters/bc-char-mara"],
      "support": ["characters/bc-char-mara#0", "chapters/bc-ch-01#0"]
    },
    {
      "id": "bc.location.keep",
      "title": "The keep",
      "category": "location",
      "gateIntent": "Eligible whenever the keep is in scene.",
      "evidenceRefs": ["chapters/bc-ch-01"],
      "support": ["places/bc-place-keep#0"]
    }
  ]
}
`;
await writeFile(path.join(batchDir, 'batch-1.json'), batchText);
await writeFile(path.join(batchDir, 'secrets.json'), JSON.stringify({
    batchId: 'batch-2',
    deckId: 'brief-core',
    titles: [{ id: 'bc.secret.x', title: 'X', category: 'secret', gateIntent: 'Later.', evidenceRefs: ['chapters/bc-ch-02'], support: ['chapters/bc-ch-02#0'] }],
}, null, 2));

const draftArgs = ['brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-1', '--file', 'characters/core_cast'];

// Unapproved: no recorded status, then a draft status.
const noStatus = cli(...draftArgs);
assert.equal(noStatus.code, 1);
assert.match(noStatus.stderr, /batch batch-1 is not approved \(status: none recorded\); approve its titles gate before drafting/);
assert.equal(cli('batch', 'set', 'brief-canon', '--deck', 'brief-core', '--kind', 'titles', '--id', 'batch-1', '--status', 'draft').code, 0);
const draftStatus = cli(...draftArgs);
assert.equal(draftStatus.code, 1);
assert.match(draftStatus.stderr, /batch batch-1 is not approved \(status: draft\)/);
assert.equal(cli('batch', 'set', 'brief-canon', '--deck', 'brief-core', '--kind', 'titles', '--id', 'batch-1', '--status', 'approved').code, 0);

// Unknown batch.
const unknownBatch = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-9', '--file', 'characters/core_cast');
assert.equal(unknownBatch.code, 1);
assert.match(unknownBatch.stderr, /Unknown batch "batch-9" for deck brief-core/);

// Selector validation.
const noFile = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-1');
assert.equal(noFile.code, 1);
assert.match(noFile.stderr, /requires --file/);
const noBatch = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--file', 'characters/core_cast');
assert.equal(noBatch.code, 1);
assert.match(noBatch.stderr, /requires --batch/);
for (const bad of ['core_cast', 'Characters/core_cast', 'characters/core/cast', '../characters/core_cast']) {
    const result = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-1', '--file', bad);
    assert.equal(result.code, 1, `--file ${bad} should be rejected.`);
    assert.match(result.stderr, /<category>\/<topic-stem>/, `${bad}: ${result.stderr}`);
}
for (const numbered of ['entries/batch-1', 'characters/batch_2', 'characters/entries3']) {
    const result = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-1', '--file', numbered);
    assert.equal(result.code, 1, `--file ${numbered} should be rejected.`);
    assert.match(result.stderr, /name entry files by topic/, `${numbered}: ${result.stderr}`);
}
const withAssignment = cli(...draftArgs, '--assignment', 'x');
assert.equal(withAssignment.code, 1);
assert.match(withAssignment.stderr, /does not take --assignment/);

// Rendering: the draft brief is self-contained.
const drafted = cli(...draftArgs);
assert.equal(drafted.code, 0, drafted.stderr);
const draftPrompt = drafted.stdout;
assert.ok(draftPrompt.includes(batchText.trimEnd()), 'The title batch should appear verbatim.');
assert.ok(draftPrompt.includes(path.join(projectDir, 'drafts', 'brief-core', 'timeline.json')), 'timeline.json path should be given.');
assert.ok(draftPrompt.includes(path.join(projectDir, 'drafts', 'brief-core', 'tags.json')), 'tags.json path should be given.');
assert.match(draftPrompt, /read-only/, 'Registries should be marked read-only.');
const citedFiles = [
    path.join(projectDir, 'evidence', 'chapters', 'chapters-01-05.json'),
    path.join(projectDir, 'evidence', 'characters', 'cast.json'),
    path.join(projectDir, 'evidence', 'places', 'keep.json'),
];
let lastIndex = -1;
for (const file of citedFiles) {
    const marker = `- \`${file}\``;
    const index = draftPrompt.indexOf(marker);
    assert.ok(index > lastIndex, `${file} should be listed once, in sorted order.`);
    assert.equal(draftPrompt.indexOf(marker, index + 1), -1, `${file} should be listed once.`);
    lastIndex = index;
}
assert.ok(draftPrompt.includes('`places/bc-place-keep`'), 'A record cited only by a support pointer should be listed.');
assert.ok(!draftPrompt.includes('unrelated.json'), 'Uncited evidence files should not be listed.');
assert.ok(!draftPrompt.includes('chapters-06-10'), 'Evidence files holding no cited record should not be listed.');
const authoringRules = (await readFile(path.join(skillDir, 'references', 'authoring-rules.md'), 'utf8')).trim();
assert.ok(draftPrompt.includes(authoringRules), 'references/authoring-rules.md should be inlined in full.');
assert.ok(draftPrompt.includes(path.join(projectDir, 'drafts', 'brief-core', 'characters', 'core_cast.json')), 'Absolute output path should be given.');
assert.ok(draftPrompt.includes('`drafts/brief-core/characters/core_cast.json`'), 'Project-relative output path should be given.');
assert.ok(draftPrompt.includes('sourceInfo.evidenceFacts'), 'Cards should be told to carry fact pointers.');
assert.ok(draftPrompt.includes('missing-tag:<namespace:value>'), 'Missing tags should come back as flags.');
assert.ok(draftPrompt.includes('## Return format'), 'Return contract should be appended.');
assert.ok(draftPrompt.includes('{"status":"ok","wrote":["drafts/brief-core/characters/core_cast.json"],"counts":{"cards":2},"gaps":[],"flags":[]}'),
    'Return contract example should carry the card count and output path.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(draftPrompt.replaceAll('{{notAPlaceholder}}', '')), 'No unresolved placeholders should remain.');
assert.ok(!draftPrompt.includes('<!--'), 'Maintainer comments should be stripped.');
assert.ok(draftPrompt.includes('The file does not exist yet'), 'A new output file should be noted as new.');

// Determinism and --json.
assert.equal(cli(...draftArgs).stdout, draftPrompt, 'Draft output should be byte-identical for identical project state.');
const draftJson = JSON.parse(cli(...draftArgs, '--json').stdout);
assert.equal(draftJson.role, 'draft');
assert.equal(draftJson.batch, 'batch-1');
assert.equal(draftJson.output, 'drafts/brief-core/characters/core_cast.json');
assert.equal(draftJson.prompt, draftPrompt);

// Lookup by batchId when the file name differs.
assert.equal(cli('batch', 'set', 'brief-canon', '--deck', 'brief-core', '--kind', 'titles', '--id', 'batch-2', '--status', 'approved').code, 0);
const byId = cli('brief', 'brief-canon', '--role', 'draft', '--deck', 'brief-core', '--batch', 'batch-2', '--file', 'secrets/major_reveals');
assert.equal(byId.code, 0, byId.stderr);
assert.ok(byId.stdout.includes('plans/title-batches/brief-core/secrets.json'), 'A batch should be found by its batchId.');

// An existing output file is extended, not replaced.
await mkdir(path.join(projectDir, 'drafts', 'brief-core', 'characters'), { recursive: true });
await writeFile(path.join(projectDir, 'drafts', 'brief-core', 'characters', 'core_cast.json'), JSON.stringify({ schemaVersion: 3, entries: [{ id: 'a' }] }));
assert.match(cli(...draftArgs).stdout, /The file already exists with 1 entry\. Read it first/);

// A cited record no evidence file holds stops the render.
await writeFile(path.join(batchDir, 'batch-1.json'), batchText.replace('"chapters/bc-ch-01#0"', '"chapters/bc-ch-99#0"'));
const unknownRecord = cli(...draftArgs);
assert.equal(unknownRecord.code, 1);
assert.match(unknownRecord.stderr, /no evidence file holds: chapters\/bc-ch-99/);

// --- Template renderer: unresolved placeholders fail ---
assert.equal(renderTemplate('a {{x}} b', { x: '{{y}}' }), 'a {{y}} b', 'Substituted values are not re-scanned.');
assert.throws(() => renderTemplate('{{x}} {{missing}}', { x: 1 }, { label: 'demo' }), /Unresolved placeholder\(s\) in demo: missing/);

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck brief tests passed.');
