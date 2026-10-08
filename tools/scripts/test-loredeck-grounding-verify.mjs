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
 * Also: --file takes any entry file inside the deck (nested, any case,
 * batch-numbered) while the draft role stays strict; an entry file missing
 * from files[] warns on stderr and asks for an unlisted-entry-file flag; the
 * timeline comes from registries.timeline and a missing one gets its own
 * step 3; items with no id are listed as plain text; and findings files
 * whose target is gone are listed as stale and left out of the counts.
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
assert.ok(cardsPrompt.includes('- `ref`: the card\'s `id`, or its `title` when it has no `id`.'), 'The finding ref should be the card id, or its title.');
assert.ok(cardsPrompt.includes(`3. Resolve \`context.validFromAnchor\` and \`context.validToAnchor\` to their anchor labels in the deck's timeline file (\`drafts/${deckId}/timeline.json\`)`), 'With a timeline, step 3 resolves anchors in it.');
// core_cast.json is not in the manifest's files[] yet: the brief renders, warns, and asks for a flag.
assert.match(cardsRendered.stderr, new RegExp(`WARNING: drafts/${deckId}/characters/core_cast\\.json is not listed in the deck manifest's files\\[\\][^\\n]*stats [^\\n]* --write`));
assert.ok(cardsPrompt.includes(`\`unlisted-entry-file:drafts/${deckId}/characters/core_cast.json\``), 'The flags note should ask for unlisted-entry-file.');
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

// The other deck's batch and entry file, so its findings below have live targets.
await writeJson(path.join(projectDir, 'plans', 'title-batches', 'verify-era', 'era-batch.json'), {
    batchId: 'era-1', deckId: 'verify-era', titles: [],
});
await writeJson(path.join(projectDir, 'drafts', 'verify-era', 'lore', 'rules.json'), { entries: [] });

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
assert.match(otherDeck.stderr, /Unknown title batch "batch-1" for deck verify-era\. Batches under plans\/title-batches\/verify-era\/: era-1\./);

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
    target: 'plans/title-batches/verify-era/era-batch.json',
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

// --- Stale findings: a findings file whose target is gone is listed, not counted ---
await writeJson(path.join(auditDir, `grounding.${deckId}.titles.gone.json`), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `plans/title-batches/${deckId}/gone.json`,
    findings: [{ ref: 'canon.gone', verdict: 'unsupported', note: 'The batch was deleted.' }],
});
await writeJson(path.join(auditDir, `grounding.${deckId}.cards.characters.renamed_away.json`), {
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `drafts/${deckId}/characters/renamed_away.json`,
    findings: [{ ref: 'canon.renamed', verdict: 'partial', note: 'The file was renamed.' }],
});
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
const titlesStale = await readFile(titlesArtifact, 'utf8');
assert.ok(titlesStale.includes('1 verified, 2 flagged across 2 findings file(s).'), 'A stale titles findings file stays out of the counts.');
assert.ok(titlesStale.includes('Stale findings files'));
assert.ok(titlesStale.includes(`- \`reviews/audit/grounding.${deckId}.titles.gone.json\`: target \`plans/title-batches/${deckId}/gone.json\` is missing`));
assert.ok(!titlesStale.includes('| canon.gone |'), 'Stale findings are not listed as flagged.');
assert.equal(cli('report', projectId, '--stage', 'cards').code, 0);
const cardsStale = await readFile(cardsArtifact, 'utf8');
assert.ok(cardsStale.includes('1 verified, 3 flagged across 2 findings file(s).'), 'A stale cards findings file stays out of the counts.');
assert.ok(cardsStale.includes(`- \`reviews/audit/grounding.${deckId}.cards.characters.renamed_away.json\`: target \`drafts/${deckId}/characters/renamed_away.json\` is missing`));
assert.ok(!cardsStale.includes('| canon.renamed |'));
// With every live findings file gone too, the stale files still show, and nothing is counted.
await rm(auditDir, { recursive: true, force: true });
await writeJson(path.join(auditDir, `grounding.${deckId}.titles.gone.json`), {
    schemaVersion: 1, role: 'grounding-verify', target: `plans/title-batches/${deckId}/gone.json`, findings: [],
});
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
const onlyStale = await readFile(titlesArtifact, 'utf8');
assert.ok(onlyStale.includes('0 verified, 0 flagged across 0 findings file(s).') && onlyStale.includes('Stale findings files'));
await rm(auditDir, { recursive: true, force: true });
assert.equal(cli('report', projectId, '--stage', 'titles').code, 0);
assert.equal(await readFile(titlesArtifact, 'utf8'), baseline, 'With no findings files the titles page is byte-identical again.');

// --- Items with no id: plain-text fallback, no nested backticks ---
await writeJson(path.join(draftsDir, 'characters', 'unnamed.json'), {
    entries: [card('', 'A card with no id.', { title: 'The `Nameless` One', sourceInfo: { evidenceFacts: ['chapters/canon-ch-01#0'] } })],
});
const noIdCards = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/unnamed');
assert.equal(noIdCards.code, 0, noIdCards.stderr);
assert.ok(noIdCards.stdout.includes('- (a card with no id: use its title, "The `Nameless` One", as the ref)'), 'A card with no id is listed as plain text.');
assert.ok(!noIdCards.stdout.includes('`(a card'), 'The no-id fallback is not wrapped in backticks.');
assert.ok(noIdCards.stdout.includes('with each `ref` matching a card\'s `id` (or its `title` when it has no `id`)'), 'Before you return names the title fallback.');
assert.ok(noIdCards.stdout.includes('for a card with no `id`, the `ref` is its `title`'));
await writeJson(path.join(batchDir, 'batch-4.json'), {
    batchId: 'batch-4',
    deckId,
    titles: [{ title: 'Untitled claim', gateIntent: 'Always eligible.', support: ['chapters/canon-ch-01#0'] }],
});
const noIdTitles = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--batch', 'batch-4');
assert.equal(noIdTitles.code, 0, noIdTitles.stderr);
assert.ok(noIdTitles.stdout.includes('- (a title with no id: use its title, "Untitled claim", as the ref)'), 'A title with no id is listed as plain text.');
assert.ok(noIdTitles.stdout.includes('- `ref`: the title\'s `id`, or its `title` when it has no `id`.'));
assert.ok(noIdTitles.stdout.includes('with each `ref` matching a title\'s `id` (or its `title` when it has no `id`)'));
await rm(path.join(batchDir, 'batch-4.json'));

// --- --file accepts any entry file health, stats and ground check read ---
const nestedCards = [card('canon.character.year-one', 'Mara Venn is a 17-year-old conscript.', { sourceInfo: { evidenceFacts: ['chapters/canon-ch-01#0'] } })];
await writeJson(path.join(draftsDir, 'characters', 'students', 'Year_One.json'), { entries: nestedCards });
await writeJson(path.join(draftsDir, 'Lore', 'batch-01.json'), { entries: nestedCards });
const nested = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/students/Year_One', '--json');
assert.equal(nested.code, 0, nested.stderr);
assert.equal(JSON.parse(nested.stdout).output, `reviews/audit/grounding.${deckId}.cards.characters.students.Year_One.json`, 'Nested paths gain more dots.');
const numbered = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'Lore/batch-01.json', '--json');
assert.equal(numbered.code, 0, numbered.stderr);
assert.equal(JSON.parse(numbered.stdout).output, `reviews/audit/grounding.${deckId}.cards.Lore.batch-01.json`);
assert.ok(JSON.parse(numbered.stdout).prompt.includes(`"target": "drafts/${deckId}/Lore/batch-01.json"`));
for (const [bad, pattern] of [
    ['../verify-era/lore/rules', /Invalid --file "\.\.\/verify-era\/lore\/rules": [^\n]*"\.\."/],
    ['characters/../../verify-era/lore/rules', /Invalid --file/],
    [path.join(draftsDir, 'characters', 'core_cast.json'), /Invalid --file [^\n]*a relative path/],
    ['timeline', /Invalid --file "timeline": [^\n]*root-level files there are the manifest and registries/],
    ['loredeck.json', /Invalid --file "loredeck\.json": [^\n]*root-level/],
    ['characters//core_cast', /Invalid --file/],
    ['assets/cover', /assets\/ holds no entry files/],
]) {
    const rejected = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', bad);
    assert.equal(rejected.code, 1, `--file ${bad} should be rejected.`);
    assert.match(rejected.stderr, pattern);
}
// The draft role keeps the strict topic-naming rules.
const draftNumbered = cli('brief', projectId, '--role', 'draft', '--deck', deckId, '--batch', 'batch-1', '--file', 'lore/batch-01');
assert.equal(draftNumbered.code, 1);
assert.match(draftNumbered.stderr, /name entry files by topic, not by batch/);
const draftNested = cli('brief', projectId, '--role', 'draft', '--deck', deckId, '--batch', 'batch-1', '--file', 'characters/students/year_one');
assert.equal(draftNested.code, 1);
assert.match(draftNested.stderr, /use <category>\/<topic-stem> in lowercase/);

// --- Listed entry files: no warning and no flag hint once stats --write runs ---
const deckDir = path.join(projectDir, 'drafts', deckId);
const stats = cli('stats', deckDir, '--write');
assert.equal(stats.code, 0, stats.stderr);
const listedBrief = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/students/Year_One');
assert.equal(listedBrief.code, 0, listedBrief.stderr);
assert.ok(!listedBrief.stderr.includes('WARNING'), listedBrief.stderr);
assert.ok(!listedBrief.stdout.includes('unlisted-entry-file'), 'A listed entry file gets no unlisted-entry-file hint.');
assert.ok(listedBrief.stdout.includes('for example `unreadable-file:<path>` for a listed file you could not read. Use'));

// --- Timeline: from registries.timeline, and worded for a missing file ---
const manifestPath = path.join(deckDir, 'loredeck.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
await writeJson(manifestPath, { ...manifest, registries: { ...manifest.registries, timeline: 'story-arc.json' } });
const missingTimeline = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/students/Year_One');
assert.equal(missingTimeline.code, 0, missingTimeline.stderr);
const storyArcRel = `drafts/${deckId}/story-arc.json`;
assert.ok(missingTimeline.stdout.includes(`3. The deck's timeline file (\`${storyArcRel}\`) does not exist, so no anchor id resolves to a label. Read the window from \`context.label\` and the anchor ids as written`), 'A missing timeline gets its own step 3.');
assert.ok(missingTimeline.stdout.includes(`(project-relative: \`${storyArcRel}\`)`), 'The timeline path comes from registries.timeline.');
assert.ok(!missingTimeline.stdout.includes('to their anchor labels'), 'A missing timeline is never to be read for anchor labels.');
assert.ok(!missingTimeline.stdout.includes('timeline.json'), 'The brief does not point at timeline.json when the manifest names another file.');
await writeJson(path.join(deckDir, 'story-arc.json'), { schemaVersion: 1, anchors: [] });
const presentTimeline = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/students/Year_One');
assert.ok(presentTimeline.stdout.includes(`to their anchor labels in the deck's timeline file (\`${storyArcRel}\`)`));
// An escaping registries.timeline falls back to timeline.json; a missing timeline.json is worded as missing.
await writeJson(manifestPath, { ...manifest, registries: { ...manifest.registries, timeline: '../verify-era/timeline.json' } });
await rm(path.join(deckDir, 'timeline.json'));
const fallback = cli('brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', 'characters/students/Year_One');
assert.equal(fallback.code, 0, fallback.stderr);
assert.ok(fallback.stdout.includes(`3. The deck's timeline file (\`drafts/${deckId}/timeline.json\`) does not exist`), 'An escaping registry falls back to timeline.json.');
assert.ok(!fallback.stdout.includes('to their anchor labels'));

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck grounding-verify tests passed.');
