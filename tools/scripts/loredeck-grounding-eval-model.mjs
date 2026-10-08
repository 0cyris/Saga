#!/usr/bin/env node
/**
 * loredeck-grounding-eval-model.mjs -- Saga
 * Opt-in model layer of the grounding eval (spec 2026-10-08 §5). Not run in
 * CI: it needs a person (or an orchestrating agent) to dispatch one grounding
 * checker per rendered brief. See fixtures/loredeck-grounding/README.md.
 *
 *   node tools/scripts/loredeck-grounding-eval-model.mjs --prepare [--variant a|b]
 *     Builds the eval project under .tmp/loredeck-grounding-eval/workshop and,
 *     for every case that passes `ground check`, renders
 *     `brief <id> --role grounding-verify --deck <deck> --file eval/<case-id>`
 *     to .tmp/loredeck-grounding-eval/briefs/<case-id>.md. Variant a is the
 *     current agents/grounding-verify.md; variant b appends
 *     fixtures/loredeck-grounding/variant-b-addendum.md (a "common mistakes"
 *     list naming the anti-patterns) to each rendered brief.
 *
 *   node tools/scripts/loredeck-grounding-eval-model.mjs --score [--json]
 *     Reads the findings files the dispatched checkers wrote
 *     (reviews/audit/grounding.<deck>.cards.eval.<case-id>.json), prints a
 *     table and the score JSON, and saves it to
 *     .tmp/loredeck-grounding-eval/score.<variant>.json. --json prints only
 *     the JSON. Missing findings files count as "not run".
 *
 * Exit codes: 0 ok (for --score: the targets were met), 1 targets missed or
 * incomplete, 2 setup error (including a CLI that cannot render card briefs).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
    buildEvalProject,
    caseBatch,
    caseFindingsRel,
    FIXTURE_DIR,
    formatScoreTable,
    groundCheckCards,
    loadCaseFindings,
    loadEvalCases,
    modelEligible,
    REPO_ROOT,
    scoreGroundingEval,
} from './loredeck-grounding-eval-lib.mjs';

const OUT_DIR = path.join(REPO_ROOT, '.tmp', 'loredeck-grounding-eval');
const WORKSHOP_ROOT = path.join(OUT_DIR, 'workshop');
const BRIEFS_DIR = path.join(OUT_DIR, 'briefs');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const VARIANTS = {
    a: 'current agents/grounding-verify.md',
    b: 'agents/grounding-verify.md + fixtures/loredeck-grounding/variant-b-addendum.md (names the anti-patterns)',
};
const USAGE = 'Usage: node tools/scripts/loredeck-grounding-eval-model.mjs --prepare [--variant a|b] | --score [--json]';

function parseArgs(argv) {
    const flags = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (!arg.startsWith('--')) throw new Error(`Unexpected argument ${JSON.stringify(arg)}. ${USAGE}`);
        const key = arg.slice(2);
        if (key === 'variant') {
            flags.variant = argv[i + 1];
            i += 1;
        } else if (['prepare', 'score', 'json', 'help'].includes(key)) {
            flags[key] = true;
        } else {
            throw new Error(`Unknown flag ${arg}. ${USAGE}`);
        }
    }
    return flags;
}

class SetupError extends Error {}

async function prepare({ variant }) {
    if (!Object.hasOwn(VARIANTS, variant)) throw new SetupError(`--variant must be a or b, got ${JSON.stringify(variant)}.`);
    const { cli, projectId, deckId, projectDir, cases } = await buildEvalProject(WORKSHOP_ROOT);

    // The structural cases must fail ground check and the rest must pass, or the briefs would be misleading.
    const { report } = groundCheckCards(cli, projectId);
    const failing = new Set(report.issues.map(issue => issue.batch));
    const eligible = modelEligible(cases);
    const unexpected = cases.filter(testCase => failing.has(caseBatch(testCase.id)) === (testCase.expectGroundCheck === 'pass'));
    if (unexpected.length) {
        throw new SetupError(`ground check disagrees with cases.json for: ${unexpected.map(testCase => testCase.id).join(', ')}. Run node tools/scripts/test-loredeck-grounding-eval.mjs first.`);
    }

    const addendum = variant === 'b' ? (await readFile(path.join(FIXTURE_DIR, 'variant-b-addendum.md'), 'utf8')).trim() : '';
    await mkdir(BRIEFS_DIR, { recursive: true });
    const manifestCases = [];
    for (const testCase of eligible) {
        const args = ['brief', projectId, '--role', 'grounding-verify', '--deck', deckId, '--file', caseBatch(testCase.id), '--json'];
        const result = cli(...args);
        if (result.code !== 0) {
            const said = (result.stderr || result.stdout).trim();
            const hint = /not yet supported|does not take --file|requires --batch/.test(said)
                ? ' This CLI cannot render grounding-verify briefs for card entry files yet: that is ticket #13 (`brief --role grounding-verify --file <entry-file stem>`). Re-run --prepare once it is merged.'
                : '';
            throw new SetupError(`Could not render the brief for case ${testCase.id}.${hint}\nCommand: loredeck ${args.join(' ')}\nCLI said: ${said}`);
        }
        const brief = JSON.parse(result.stdout);
        const prompt = addendum ? `${brief.prompt.trimEnd()}\n\n${addendum}\n` : brief.prompt;
        const briefFile = path.join(BRIEFS_DIR, `${testCase.id}.md`);
        await writeFile(briefFile, prompt);
        const findingsRel = brief.output || caseFindingsRel(deckId, testCase.id);
        manifestCases.push({ id: testCase.id, brief: briefFile, findings: path.join(projectDir, ...findingsRel.split('/')) });
    }
    const manifest = { schemaVersion: 1, variant, variantDescription: VARIANTS[variant], projectId, deckId, projectDir, cases: manifestCases };
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`Prepared variant ${variant} (${VARIANTS[variant]}).`);
    console.log(`Project: ${projectDir}`);
    console.log(`${manifestCases.length} briefs in ${BRIEFS_DIR} (${cases.length - eligible.length} structural cases are left to ground check).`);
    console.log('');
    console.log('Next: dispatch one fresh grounding checker per brief, passing the brief text through unchanged');
    console.log('(the loredeck-grounding-verifier agent, or any subagent), then run:');
    console.log('  node tools/scripts/loredeck-grounding-eval-model.mjs --score');
    return 0;
}

async function score({ json }) {
    let manifest = null;
    try {
        manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
    } catch (_) {
        throw new SetupError(`No ${path.relative(REPO_ROOT, MANIFEST)}. Run --prepare first.`);
    }
    const { cases } = await loadEvalCases();
    const findingsPaths = Object.fromEntries(manifest.cases.map(entry => [entry.id, entry.findings]));
    const findings = await loadCaseFindings({ projectDir: manifest.projectDir, deckId: manifest.deckId, cases: modelEligible(cases), findingsPaths });
    const result = { variant: manifest.variant, variantDescription: manifest.variantDescription, ...scoreGroundingEval(cases, findings) };
    const scoreFile = path.join(OUT_DIR, `score.${manifest.variant}.json`);
    await writeFile(scoreFile, `${JSON.stringify(result, null, 2)}\n`);
    if (json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        process.stdout.write(formatScoreTable(result, { variant: manifest.variant }));
        console.log('');
        console.log(JSON.stringify(result, null, 2));
        console.log('');
        console.log(`Saved to ${path.relative(REPO_ROOT, scoreFile)}. Record the numbers in spec §5.1 (docs/superpowers/specs/2026-10-08-loredeck-builder-multi-agent-design.md).`);
    }
    return result.result === 'pass' ? 0 : 1;
}

async function main() {
    const flags = parseArgs(process.argv.slice(2));
    if (flags.help || (!flags.prepare && !flags.score) || (flags.prepare && flags.score)) {
        console.log(USAGE);
        return flags.help ? 0 : 2;
    }
    if (flags.prepare) return prepare({ variant: flags.variant || 'a' });
    if (flags.variant) throw new SetupError('--variant applies to --prepare; --score reads it from the prepared manifest.');
    return score({ json: Boolean(flags.json) });
}

try {
    process.exitCode = await main();
} catch (error) {
    console.error(error instanceof SetupError ? error.message : (error?.stack || String(error)));
    process.exitCode = 2;
}
