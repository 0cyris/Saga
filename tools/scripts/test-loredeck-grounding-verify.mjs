/**
 * test-loredeck-grounding-verify.mjs -- Saga
 * Exercises the grounding checker for title batches: `brief --role
 * grounding-verify --batch B` renders a clean-context prompt (batch path,
 * sorted cited evidence files, pointer reading, verdicts, findings shape,
 * return contract), resolves a batch by file name or by batchId, rejects an
 * unknown batch or one whose file name and batchId disagree, lists malformed
 * support pointers as naming no fact, and `report --stage titles` summarizes
 * findings files when present while staying byte-identical when none exist.
 * For card batches, `--file <category>/<topic-stem>` renders the cards
 * variant (entry file, cited evidence, deck timeline, card ids, dotted
 * findings name), rejects --batch with --file, neither, and an unknown entry
 * file, lists malformed evidenceFacts pointers, and `report --stage cards`
 * summarizes only card findings, staying byte-identical when none exist.
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
assert.ok(prompt.includes(path.join(auditDir, `grounding.${deckId}.titles.batch-1.json`)), 'The findings file path should be given.');
assert.ok(prompt.includes(`reviews/audit/grounding.${deckId}.titles.batch-1.json`), 'The project-relative findings path should be given.');
assert.ok(prompt.includes('"role": "grounding-verify"') && prompt.includes(`"target": "plans/title-batches/${deckId}/batch-1.json"`),
    'The findings file shape should be shown.');
assert.ok(prompt.includes('`canon.character.mara-venn`') && prompt.includes('`canon.location.ravenhold-keep`'), 'Title ids should be listed.');
assert.ok(/note[^\n]*required[^\n]*quote/i.test(prompt), 'A note quoting fact text should be required for non-entailed verdicts.');
assert.ok(/read-only/i.test(prompt), 'The prompt should say the checker is read-only.');
assert.ok(/nothing you know or remember/i.test(prompt), 'The prompt should forbid judging from memory.');
assert.ok(prompt.includes('## Return format'), 'The return contract should be appended.');
assert.ok(prompt.includes(`{"status":"ok","wrote":["reviews/audit/grounding.${deckId}.titles.batch-1.json"],"counts":{"titles":2,"flagged":0},"gaps":[],"flags":[]}`),
    'The return contract example should carry the findings path and counts.');
assert.ok(!prompt.includes(DRAFTING_NOTE) && !prompt.includes('ORCHESTRATOR-ONLY'), 'No drafting commentary may reach the checker.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(prompt), 'No unresolved placeholders should remain.');
assert.ok(!prompt.includes('<!--'), 'Maintainer comments should be stripped.');

const again = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1');
assert.equal(again.stdout, prompt, 'Output should be byte-identical for identical project state.');

const asJson = JSON.parse(cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1', '--json').stdout);
assert.equal(asJson.role, 'grounding-verify');
assert.equal(asJson.batch, 'batch-1');
assert.equal(asJson.output, `reviews/audit/grounding.${deckId}.titles.batch-1.json`);

// A batch can be named by its batchId when the file name differs.
const byId = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-2');
assert.equal(byId.code, 0, byId.stderr);
assert.ok(byId.stdout.includes(path.join(batchDir, 'second.json')), 'batchId lookup should find second.json.');
assert.ok(byId.stdout.includes(`reviews/audit/grounding.${deckId}.titles.batch-2.json`));
assert.ok(byId.stdout.includes('Every record the batch cites is in one of the files above.'));

assert.ok(prompt.includes('The factIndex is the digits after the last `#`; a recordId may itself contain `#`.'), 'The prompt should say how to split a pointer.');
assert.ok(prompt.includes('Judge only `id`, `gateIntent`, `support` and `evidenceRefs`; ignore any other batch fields.'), 'The prompt should name the fields to judge.');
assert.ok(prompt.includes('If the findings file already exists, read it first, then replace it entirely.'), 'The prompt should say to replace an existing findings file.');

// A file found by name must carry that batchId; findings use the canonical id.
const byFileName = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'second');
assert.equal(byFileName.code, 1);
assert.match(byFileName.stderr, /plans\/title-batches\/verify-core\/second\.json has batchId batch-2; pass --batch batch-2 \(file names and batchIds must agree\)/);

// Malformed support pointers are listed as naming no fact, not dropped.
await writeJson(path.join(batchDir, 'batch-3.json'), {
    batchId: 'batch-3',
    deckId,
    titles: [{
        id: 'canon.lore.bad-pointers',
        title: 'Bad pointers',
        category: 'lore',
        gateIntent: 'Always eligible.',
        evidenceRefs: ['chapters/canon-ch-01'],
        support: ['chapters/canon-ch-01', 'chapters/canon-ch-01#first', 'chapters/canon-ch-01#0'],
    }],
});
const malformed = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-3');
assert.equal(malformed.code, 0, malformed.stderr);
assert.ok(malformed.stdout.includes('- `chapters/canon-ch-01` in `canon.lore.bad-pointers`: names no fact'), 'A pointer with no index should be listed.');
assert.ok(malformed.stdout.includes('- `chapters/canon-ch-01#first` in `canon.lore.bad-pointers`: names no fact'), 'A pointer with a non-numeric index should be listed.');
assert.ok(!malformed.stdout.includes('Every record the batch cites is in one of the files above.'), 'Malformed pointers must not be reported as all-clear.');
await rm(path.join(batchDir, 'batch-3.json'));

// --- Card batches: one entry file in drafts/<deck>/ ---
const draftsDir = path.join(projectDir, 'drafts', deckId);
const cardsFile = path.join(draftsDir, 'characters', 'core_cast.json');
const timelinePath = path.join(draftsDir, 'timeline.json');
function card(id, fact, extra = {}) {
    return {
        id,
        title: id,
        category: 'character',
        revealPolicy: 'public',
        content: { fact, injection: `${fact} (injection)` },
        context: { scope: 'window', validFromAnchor: 'verify.opening', validToAnchor: 'verify.ending', label: 'Whole story' },
        ...extra,
    };
}
await writeJson(cardsFile, {
    entries: [
        card('canon.character.mara-venn', 'Mara Venn is a 17-year-old conscript.', {
            notes: DRAFTING_NOTE,
            sourceInfo: { evidenceRefs: ['chapters/canon-ch-01'], evidenceFacts: ['chapters/canon-ch-01#0'] },
        }),
        card('canon.secret.sethe-ashen-pact', 'Warden Sethe swore to the Ashen Pact.', {
            revealPolicy: 'private',
            sourceInfo: { evidenceRefs: ['places/canon-place-ravenhold'], evidenceFacts: ['chapters/canon-ch-14#0', 'places/canon-place-ravenhold#0', 'ghosts/missing-card-record#0', 'chapters/canon-ch-14'] },
        }),
        card('canon.character.no-facts', 'Nothing cites this.'),
    ],
});

const cardsRendered = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/core_cast');
assert.equal(cardsRendered.code, 0, cardsRendered.stderr);
const cardsPrompt = cardsRendered.stdout;
assert.ok(cardsPrompt.startsWith(`# Grounding check: card batch \`characters/core_cast\` of deck \`${deckId}\``), cardsPrompt.slice(0, 200));
assert.ok(cardsPrompt.includes(`- \`${cardsFile}\` (project-relative: \`drafts/${deckId}/characters/core_cast.json\`)`), 'The entry file path should be given.');
assert.ok(cardsPrompt.includes(chaptersPath) && cardsPrompt.includes(placesPath), 'Every cited evidence file should be listed.');
assert.ok(cardsPrompt.indexOf(chaptersPath) < cardsPrompt.indexOf(placesPath), 'Evidence files should be sorted.');
assert.equal(cardsPrompt.split(chaptersPath).length - 1, 1, 'Evidence files should be deduplicated.');
assert.ok(!cardsPrompt.includes('unrelated.json'), 'Uncited evidence files should be left out.');
assert.ok(cardsPrompt.includes(`- \`${timelinePath}\` (project-relative: \`drafts/${deckId}/timeline.json\`)`), 'The deck timeline path should be given.');
assert.ok(/timeline, read-only, to resolve each card's `context.validFromAnchor` and `context.validToAnchor`/.test(cardsPrompt), 'The timeline should be read-only and used to resolve anchors.');
assert.ok(cardsPrompt.includes('`ghosts/missing-card-record`'), 'A cited record missing from the evidence should be named.');
assert.ok(cardsPrompt.includes('- `chapters/canon-ch-14` in `canon.secret.sethe-ashen-pact`: names no fact'), 'A malformed evidenceFacts pointer should be listed.');
assert.ok(cardsPrompt.includes('These `sourceInfo.evidenceFacts` pointers are not of the form'), 'Malformed card pointers should be named by their field.');
assert.ok(cardsPrompt.includes('`canon.character.mara-venn`') && cardsPrompt.includes('`canon.secret.sethe-ashen-pact`') && cardsPrompt.includes('`canon.character.no-facts`'), 'Card ids should be listed.');
assert.ok(cardsPrompt.includes('- `ref`: the card\'s `id`.'), 'The finding ref should be the card id.');
assert.ok(cardsPrompt.includes('`content.fact` and `content.injection`'), 'The claim fields should be named.');
assert.ok(cardsPrompt.includes('0-based index') && cardsPrompt.includes('The factIndex is the digits after the last `#`; a recordId may itself contain `#`.'));
for (const verdict of GROUNDING_VERDICTS) {
    assert.ok(cardsPrompt.includes(`- \`${verdict}\`:`), `The prompt should define verdict ${verdict} for cards.`);
}
assert.match(cardsPrompt, /`timing-mismatch`: [^\n]*context window opens before the story point[^\n]*reveal policy exposes something the facts place later/, 'timing-mismatch should cover the window and reveal policy.');
assert.match(cardsPrompt, /`unsupported`: [^\n]*a card with no `sourceInfo.evidenceFacts`/);
const cardsOutputRel = `reviews/audit/grounding.${deckId}.cards.characters.core_cast.json`;
assert.ok(cardsPrompt.includes(path.join(auditDir, `grounding.${deckId}.cards.characters.core_cast.json`)), 'The findings file path should use dots.');
assert.ok(cardsPrompt.includes(`"target": "drafts/${deckId}/characters/core_cast.json"`), 'The findings target should be the entry file.');
assert.ok(cardsPrompt.includes(`{"status":"ok","wrote":["${cardsOutputRel}"],"counts":{"cards":3,"flagged":0},"gaps":[],"flags":[]}`), 'The return example should carry the findings path and card count.');
assert.ok(/note[^\n]*required[^\n]*quote/i.test(cardsPrompt) && /read-only/i.test(cardsPrompt) && /nothing you know or remember/i.test(cardsPrompt));
assert.ok(!cardsPrompt.includes(DRAFTING_NOTE), 'No drafting commentary may reach the checker.');
assert.ok(!cardsPrompt.includes('gateIntent') && !cardsPrompt.includes('title batch'), 'The cards brief should not carry title wording.');
assert.ok(!/\{\{\s*[A-Za-z]/.test(cardsPrompt) && !cardsPrompt.includes('<!--'));
assert.equal(cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/core_cast').stdout, cardsPrompt, 'Card briefs should be deterministic.');
const cardsJson = JSON.parse(cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/core_cast.json', '--json').stdout);
assert.equal(cardsJson.output, cardsOutputRel);
assert.equal(cardsJson.batch, null);

// A bare-array entry file reads too.
await writeJson(path.join(draftsDir, 'places', 'keeps.json'), [card('canon.location.ravenhold', 'Ravenhold Keep is a mountain garrison.', { sourceInfo: { evidenceFacts: ['places/canon-place-ravenhold#0'] } })]);
const bare = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'places/keeps');
assert.equal(bare.code, 0, bare.stderr);
assert.ok(bare.stdout.includes('Every record the batch cites is in one of the files above.'));
assert.ok(bare.stdout.includes(`reviews/audit/grounding.${deckId}.cards.places.keeps.json`));

const unknownFile = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/nobody');
assert.equal(unknownFile.code, 1);
assert.match(unknownFile.stderr, /No entry file at drafts\/verify-core\/characters\/nobody\.json/);
const badFile = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters');
assert.equal(badFile.code, 1);
assert.match(badFile.stderr, /Invalid --file "characters": use <category>\/<topic-stem>/);
const traversalFile = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', '../characters/core_cast');
assert.equal(traversalFile.code, 1);
assert.match(traversalFile.stderr, /Invalid --file/);

// The cards page before any checker runs, for the byte-identical check below.
const cardsArtifact = path.join(projectDir, 'reviews', 'cards.md');
assert.equal(cli('report', projectId, '--stage', 'cards').code, 0);
const cardsBaseline = await readFile(cardsArtifact, 'utf8');
assert.ok(!cardsBaseline.includes('Grounding checker findings'));

// --- Errors ---
const unknownBatch = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-9');
assert.equal(unknownBatch.code, 1);
assert.match(unknownBatch.stderr, /Unknown title batch "batch-9" for deck verify-core\. Batches under plans\/title-batches\/verify-core\/: batch-1, batch-2\./);

const otherDeck = cli('brief', projectId, '--role', 'grounding-verify', '--deck', 'verify-era', '--batch', 'batch-1');
assert.equal(otherDeck.code, 1);
assert.match(otherDeck.stderr, /No title batches found under plans\/title-batches\/verify-era\//);

const neither = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId);
assert.equal(neither.code, 1);
assert.match(neither.stderr, /requires --batch <title-batch-id> \(a title batch\) or --file <category>\/<topic-stem> \(a card batch\)/);

const both = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1', '--file', 'characters/core_cast');
assert.equal(both.code, 1);
assert.match(both.stderr, /takes either --batch <title-batch-id> or --file <category>\/<topic-stem>, not both/);

const scoped = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-1', '--scope', 'chapters');
assert.equal(scoped.code, 1);
assert.match(scoped.stderr, /does not take --scope/);

const traversal = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', '../batch-1');
assert.equal(traversal.code, 1);
assert.match(traversal.stderr, /Invalid --batch/);

// --- The agent file defers to the role template ---
const agentFile = await readFile(path.join(repoRoot, '.claude', 'agents', 'loredeck-grounding-verifier.md'), 'utf8');
assert.match(agentFile, /\nmaxTurns: 40\n/);
assert.match(agentFile, /^---\nname: loredeck-grounding-verifier\n/);
assert.match(agentFile, /\ntools: Read, Grep, Glob, Write\n/);
assert.match(agentFile, /\nmodel: inherit\n/);
assert.ok(agentFile.includes('--role grounding-verify'), 'The agent file should point at the rendered brief.');
assert.match(agentFile, /\ndescription: [^\n]*card batches/, 'The agent description should cover card batches.');
assert.ok(agentFile.includes('--file <category>/<topic-stem>'), 'The agent file should name the card-batch brief.');

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
await writeJson(path.join(auditDir, `grounding.${deckId}.cards.characters.json`), {
    schemaVersion: 1, role: 'grounding-verify', target: 'drafts/x.json', findings: [{ ref: 'c', verdict: 'unsupported', note: 'x' }],
});
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
assert.equal(await readFile(titlesArtifact, 'utf8'), baseline, 'Without titles findings the artifact must be byte-identical.');

await writeJson(path.join(auditDir, `grounding.${deckId}.titles.batch-1.json`), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `plans/title-batches/${deckId}/batch-1.json`,
    findings: [
        { ref: 'canon.character.mara-venn', verdict: 'entailed', note: '' },
        { ref: 'canon.location.ravenhold-keep', verdict: 'partial', note: 'places/canon-place-ravenhold#0 says "Ravenhold Keep is a mountain garrison." Nothing backs ghosts/missing-record.' },
    ],
});
await writeJson(path.join(auditDir, 'grounding.verify-era.titles.batch-1.json'), {
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

// --- Report: the cards page summarizes card findings only ---
// Titles findings are present; drop the placeholder card file written above first.
await rm(path.join(auditDir, `grounding.${deckId}.cards.characters.json`));
assert.equal(cli('report', projectId, '--stage', 'cards').code, 0);
assert.equal(await readFile(cardsArtifact, 'utf8'), cardsBaseline, 'Without card findings the cards page must be byte-identical.');

await writeJson(path.join(auditDir, `grounding.${deckId}.cards.characters.core_cast.json`), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `drafts/${deckId}/characters/core_cast.json`,
    findings: [
        { ref: 'canon.character.mara-venn', verdict: 'entailed', note: '' },
        { ref: 'canon.secret.sethe-ashen-pact', verdict: 'timing-mismatch', note: 'chapters/canon-ch-14#0 says "Warden Sethe is revealed to have sworn to the Ashen Pact." The window opens at the opening.' },
        { ref: 'canon.character.no-facts', verdict: 'unsupported', note: 'No sourceInfo.evidenceFacts.' },
    ],
});
await writeJson(path.join(auditDir, 'grounding.verify-era.cards.lore.rules.json'), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: 'drafts/verify-era/lore/rules.json',
    findings: [{ ref: 'era.card', verdict: 'partial', note: 'Half of it is backed.' }],
});
const cardsReport = cli('report', projectId, '--stage', 'cards');
assert.equal(cardsReport.code, 0, cardsReport.stderr);
const cardsSummarized = await readFile(cardsArtifact, 'utf8');
const [cardsHeading] = cardsBaseline.split('\n');
assert.ok(cardsSummarized.startsWith(`${cardsHeading}\n\n## Grounding checker findings\n\n1 verified, 3 flagged across 2 findings file(s).`),
    `The findings summary should sit at the top of the cards page:\n${cardsSummarized.slice(0, 400)}`);
assert.ok(cardsSummarized.includes('| canon.secret.sethe-ashen-pact | timing-mismatch |'));
assert.ok(cardsSummarized.includes('| era.card | partial |'), 'Card findings from every deck should be summarized.');
assert.ok(!cardsSummarized.includes('canon.location.ravenhold-keep | partial') && !cardsSummarized.includes('era.title'), 'Titles findings stay out of the cards page.');
assert.ok(cardsSummarized.endsWith(cardsBaseline.slice(cardsHeading.length + 2)), 'The rest of the cards page should be unchanged.');

// And card findings stay out of the titles page.
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
const titlesAfter = await readFile(titlesArtifact, 'utf8');
assert.ok(!titlesAfter.includes('sethe-ashen-pact | timing-mismatch') && !titlesAfter.includes('era.card'), 'Card findings stay out of the titles page.');
assert.ok(titlesAfter.includes('1 verified, 2 flagged across 2 findings file(s).'));

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck grounding-verify tests passed.');
