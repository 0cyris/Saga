/**
 * test-loredeck-review-artifacts.mjs -- Saga
 * Exercises the two report-tooling gaps closed for the loredeck-builder
 * skill: scope-brief completeness checking and inlined plan rationale.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const workshopRoot = path.join(repoRoot, '.tmp', 'test-loredeck-review-artifacts');
const cliPath = path.join(repoRoot, 'tools', 'loredeck', 'loredeck-cli.mjs');
const projectDir = path.join(workshopRoot, 'report-canon');

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
assert.equal(cli('init', 'report-canon', '--title', 'Report Canon').code, 0);

// --- Brief completeness: still-template placeholder text ---
const placeholderBrief = `# Scope Brief: <Canon Name>

## Fandom and source range

*What canon is covered, which specific sources back it, and exactly where coverage starts and stops.*

- Covers: *e.g. "The Founding Trilogy" novels, books 1-3.*
- Coverage starts at: *e.g. Book 1, Chapter 1.*

## Continuity and canon tier

*Which continuity/adaptation this deck models.*

- Continuity id: *e.g. \`foundingverse-novels\`.*

## Deck split

*Single deck or a family.*

- Shape: *\`single\` | \`family\`.*
- Decks (family only):
  - *\`foundingverse-core\` (role: core) -- shared across the family.*

## Story-coordinate model

*What Context is measured in for this canon.*

- Primary axis: *e.g. book + chapter.*

## Spoiler philosophy

*What must stay gated and until when.*

- Default posture: *e.g. gate all deaths until confirmed.*

## Assumptions and risks

*Anything uncertain, contested, or deferred.*

- *e.g. Two wiki pages disagree on a date.*
`;

await mkdir(path.join(projectDir, 'brief'), { recursive: true });
await writeFile(path.join(projectDir, 'brief', 'scope-brief.md'), placeholderBrief);

const placeholderReport = cliJson('report', 'report-canon', '--stage', 'brief');
assert.equal(placeholderReport.briefIssues, 6, 'Every section should still read as placeholder text.');
const placeholderMarkdown = await readFile(path.join(projectDir, 'reviews', 'brief.md'), 'utf8');
assert.ok(placeholderMarkdown.includes('## Completeness check'));
for (const section of [
    'Fandom and source range',
    'Continuity and canon tier',
    'Deck split',
    'Story-coordinate model',
    'Spoiler philosophy',
    'Assumptions and risks',
]) {
    assert.ok(placeholderMarkdown.includes(section), `Completeness check should mention "${section}".`);
}

// --- Brief completeness: real content in every section ---
const filledBrief = `# Scope Brief: The Founding Trilogy

## Fandom and source range

Covers "The Founding Trilogy" novels, books 1-3 (2011-2015 UK hardback editions). Coverage starts at Book 1 Chapter 1 and stops at the Book 3 epilogue.

## Continuity and canon tier

Continuity id: foundingverse-novels. Canon tier: primary (author's original prose). No adaptation modeled.

## Deck split

Family deck, split by book.

- Shape: family
- Decks:
  - foundingverse-core (role: core) - shared world rules.
  - foundingverse-book1 (role: era) - Book 1 specific reveals.

## Story-coordinate model

Primary axis is book + chapter, story order, no in-world calendar. Flashbacks are common; sort by narrative reveal order.

## Spoiler philosophy

Hard-gated reveals: the mentor's betrayal unlocks at Book 2 Chapter 14. Default posture: gate all deaths and identities to the confirming scene.

## Assumptions and risks

Two wiki pages disagree on the fall of the capital's date; recorded as contested pending primary-text confirmation.
`;

await writeFile(path.join(projectDir, 'brief', 'scope-brief.md'), filledBrief);
const filledReport = cliJson('report', 'report-canon', '--stage', 'brief');
assert.equal(filledReport.briefIssues, 0, 'A fully-written brief should report zero completeness issues.');
const filledMarkdown = await readFile(path.join(projectDir, 'reviews', 'brief.md'), 'utf8');
assert.ok(!filledMarkdown.includes('## Completeness check'), 'No completeness section should render once every section is filled in.');

// --- Plan rationale: missing file ---
const noPlanReport = cli('report', 'report-canon', '--stage', 'plan');
assert.equal(noPlanReport.code, 0, noPlanReport.stderr);
const noPlanMarkdown = await readFile(path.join(projectDir, 'reviews', 'plan.md'), 'utf8');
assert.ok(noPlanMarkdown.includes('_No prose plan written yet'), 'Missing plan file should render the placeholder line.');
assert.ok(!noPlanMarkdown.includes('## Rationale'), 'No Rationale section should render without a plan file.');

// --- Plan rationale: written prose gets inlined ---
await mkdir(path.join(projectDir, 'plans'), { recursive: true });
const planProse = 'We use book+chapter as the primary axis because the source has no in-world calendar. Anchors are placed at every POV shift.';
await writeFile(path.join(projectDir, 'plans', 'context-timeline-plan.md'), planProse);
const withPlanReport = cli('report', 'report-canon', '--stage', 'plan');
assert.equal(withPlanReport.code, 0, withPlanReport.stderr);
const withPlanMarkdown = await readFile(path.join(projectDir, 'reviews', 'plan.md'), 'utf8');
assert.ok(withPlanMarkdown.includes('## Rationale'), 'Rationale heading should appear once a plan file exists.');
assert.ok(withPlanMarkdown.includes(planProse), 'The plan prose itself should be inlined verbatim, not just referenced.');

await rm(workshopRoot, { recursive: true, force: true });
console.log('Loredeck review artifact tests passed.');
