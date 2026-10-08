/**
 * loredeck-grounding-eval-lib.mjs -- Saga
 * Shared pieces of the Loredeck grounding eval (spec 2026-10-08 §5): the
 * labelled fixture set in fixtures/loredeck-grounding/, a builder that turns
 * it into a workshop project through the CLI (one card per entry file, so
 * ground-check issues and checker findings map 1:1 to cases), the findings
 * loader, and the scorer behind `loredeck-grounding-eval-model.mjs --score`.
 *
 * Used by test-loredeck-grounding-eval.mjs (CI, deterministic layer) and
 * loredeck-grounding-eval-model.mjs (manual, model layer).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GROUNDING_VERDICTS } from '../loredeck/lib/briefs.mjs';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
export const FIXTURE_DIR = path.join(REPO_ROOT, 'tools', 'scripts', 'fixtures', 'loredeck-grounding');
export const CLI_PATH = path.join(REPO_ROOT, 'tools', 'loredeck', 'loredeck-cli.mjs');

/**
 * Where the model layer builds its workshop and briefs: outside the repo, so a
 * checker browsing the project cannot walk up to cases.json. Override with
 * LOREDECK_GROUNDING_EVAL_DIR. The manifest (handle -> case id) and the score
 * files live in the sibling `<dir>-results`, never inside the workshop tree.
 */
export function modelLayerDirs(env = process.env) {
    const dir = path.resolve(env.LOREDECK_GROUNDING_EVAL_DIR || path.join(os.tmpdir(), 'loredeck-grounding-eval'));
    return {
        dir,
        workshopRoot: path.join(dir, 'workshop'),
        briefsDir: path.join(dir, 'briefs'),
        resultsDir: `${dir}-results`,
    };
}

/** Neutral project title: nothing a checker reads may say this is a test. */
export const PROJECT_TITLE = 'The Founding Trilogy';

/** Ship targets (spec §5, O2): catch rate on seeded semantic cases, false-alarm rate on controls. */
export const EVAL_TARGETS = { catchRate: 0.85, falseAlarmRate: 0.10 };

export const CASE_LABELS = ['control', 'seeded'];
export const CASE_KINDS = ['structural', 'semantic'];

export async function loadEvalCases() {
    const json = JSON.parse(await readFile(path.join(FIXTURE_DIR, 'cases.json'), 'utf8'));
    return { deckId: json.deckId, acceptedEvidence: json.acceptedEvidence, cases: json.cases };
}

/**
 * Opaque, deterministic handle for a case. Case ids name the planted error
 * ("timing-...", "control-..."), so they must never reach a checker: file
 * names, brief names and findings names all use this handle instead.
 */
export function caseHandle(caseId) {
    return `card-${createHash('sha256').update(String(caseId)).digest('hex').slice(0, 8)}`;
}

/** Entry-file stem for a case, relative to drafts/<deck>/ (the ground-check `batch` and the brief's --file). */
export function caseBatch(caseId) {
    return `entries/${caseHandle(caseId)}`;
}

/** Default findings path for a case (spec §9: grounding.<deck>.cards.<batch with / as .>.json). */
export function caseFindingsRel(deckId, caseId) {
    return `reviews/audit/grounding.${deckId}.cards.${caseBatch(caseId).replaceAll('/', '.')}.json`;
}

/** Verdicts that count as exact for a case: `acceptVerdicts`, defaulting to `[expectVerdict]`. */
export function acceptedVerdicts(testCase) {
    return Array.isArray(testCase.acceptVerdicts) && testCase.acceptVerdicts.length
        ? testCase.acceptVerdicts
        : [testCase.expectVerdict];
}

/** Cases the model layer runs: every case that passes `ground check`. */
export function modelEligible(cases) {
    return cases.filter(testCase => testCase.expectGroundCheck === 'pass');
}

export function makeCli(workshopRoot) {
    return (...args) => {
        const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
            cwd: REPO_ROOT,
            env: { ...process.env, SAGA_WORKSHOP_ROOT: workshopRoot },
            encoding: 'utf8',
        });
        return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
    };
}

function mustSucceed(result, what) {
    if (result.code !== 0) {
        throw new Error(`${what} failed (exit ${result.code}): ${(result.stderr || result.stdout).trim()}`);
    }
    return result;
}

/**
 * Builds a fresh workshop project from the fixtures, through the CLI: init,
 * copy evidence in and accept the listed records (the pending one stays
 * pending), copy the timeline, tags and scope brief, write each case's card
 * to drafts/<deck>/entries/<handle>.json, and run `stats --write`.
 * Returns `{ cli, projectId, deckId, projectDir, deckDir, cases }`.
 */
export async function buildEvalProject(workshopRoot) {
    const { deckId, acceptedEvidence, cases } = await loadEvalCases();
    const projectId = deckId;
    const cli = makeCli(workshopRoot);
    const projectDir = path.join(workshopRoot, projectId);
    const deckDir = path.join(projectDir, 'drafts', deckId);

    await rm(workshopRoot, { recursive: true, force: true });
    mustSucceed(cli('init', projectId, '--title', PROJECT_TITLE), 'init');
    await cp(path.join(FIXTURE_DIR, 'evidence'), path.join(projectDir, 'evidence'), { recursive: true });
    mustSucceed(cli('evidence', 'validate', projectId), 'evidence validate');
    const byScope = new Map();
    for (const key of acceptedEvidence) {
        const [scope, ...rest] = key.split('/');
        if (!byScope.has(scope)) byScope.set(scope, []);
        byScope.get(scope).push(rest.join('/'));
    }
    for (const [scope, ids] of byScope) {
        mustSucceed(cli('evidence', 'accept', projectId, '--scope', scope, '--ids', ids.join(',')), `evidence accept ${scope}`);
    }
    await copyFile(path.join(FIXTURE_DIR, 'scope-brief.md'), path.join(projectDir, 'brief', 'scope-brief.md'));
    await copyFile(path.join(FIXTURE_DIR, 'timeline.json'), path.join(deckDir, 'timeline.json'));
    await copyFile(path.join(FIXTURE_DIR, 'tags.json'), path.join(deckDir, 'tags.json'));
    for (const testCase of cases) {
        const file = path.join(deckDir, ...`${caseBatch(testCase.id)}.json`.split('/'));
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, `${JSON.stringify({ schemaVersion: 3, entries: [testCase.card] }, null, 2)}\n`);
    }
    mustSucceed(cli('stats', deckDir, '--write'), 'stats --write');
    return { cli, projectId, deckId, projectDir, deckDir, cases };
}

/** Runs `ground check --stage cards --json` and returns the parsed report plus exit code. */
export function groundCheckCards(cli, projectId) {
    const result = cli('ground', 'check', projectId, '--stage', 'cards', '--json');
    let report = null;
    try {
        report = JSON.parse(result.stdout);
    } catch (error) {
        throw new Error(`ground check did not print JSON (exit ${result.code}): ${result.stderr || result.stdout}`);
    }
    return { code: result.code, report };
}

/**
 * Reads the findings file for each case. `findingsPaths` maps case id to an
 * absolute path (default: caseFindingsRel under projectDir). Returns
 * Map<caseId, { status: 'ran', verdict, note, file } | { status: 'not-run', file }
 * | { status: 'invalid', file, detail }>. A missing file is "not run"; a file
 * that does not parse, lacks the card's finding, or uses an unknown verdict
 * is "invalid".
 */
export async function loadCaseFindings({ projectDir, deckId, cases, findingsPaths = {} }) {
    const results = new Map();
    for (const testCase of cases) {
        const file = findingsPaths[testCase.id] || path.join(projectDir, ...caseFindingsRel(deckId, testCase.id).split('/'));
        let text = null;
        try {
            text = await readFile(file, 'utf8');
        } catch (error) {
            if (error?.code === 'ENOENT') {
                results.set(testCase.id, { status: 'not-run', file });
                continue;
            }
            results.set(testCase.id, { status: 'invalid', file, detail: `unreadable: ${error?.message || error}` });
            continue;
        }
        let json = null;
        try {
            json = JSON.parse(text);
        } catch (error) {
            results.set(testCase.id, { status: 'invalid', file, detail: `not valid JSON: ${error?.message || error}` });
            continue;
        }
        const findings = Array.isArray(json?.findings) ? json.findings : [];
        const matching = findings.filter(finding => finding?.ref === testCase.card.id);
        if (matching.length !== 1) {
            results.set(testCase.id, { status: 'invalid', file, detail: `expected exactly one finding with ref ${testCase.card.id}, found ${matching.length}` });
            continue;
        }
        const [finding] = matching;
        if (!GROUNDING_VERDICTS.includes(finding.verdict)) {
            results.set(testCase.id, { status: 'invalid', file, detail: `unknown verdict ${JSON.stringify(finding.verdict)}` });
            continue;
        }
        results.set(testCase.id, { status: 'ran', verdict: finding.verdict, note: String(finding.note ?? ''), file });
    }
    return results;
}

function ratio(numerator, denominator) {
    return denominator ? numerator / denominator : null;
}

/**
 * Scores checker findings against the labelled cases. Only model-eligible
 * cases (expectGroundCheck "pass") are scored. `findings` is the Map from
 * loadCaseFindings (or any Map<caseId, { status, verdict? }>).
 *
 * - catch rate: seeded semantic cases with verdict != entailed / seeded semantic cases that ran
 * - exact-verdict accuracy: verdict in acceptVerdicts (default [expectVerdict]) / cases that ran
 * - false-alarm rate: controls with verdict != entailed / controls that ran
 *
 * "not run" and "invalid" cases leave the denominators and make the result
 * `incomplete`; the overall result is `pass` only when every case ran and
 * both targets are met.
 */
export function scoreGroundingEval(cases, findings, { targets = EVAL_TARGETS } = {}) {
    const eligible = modelEligible(cases);
    const rows = eligible.map((testCase) => {
        const finding = findings.get(testCase.id) || { status: 'not-run' };
        const ran = finding.status === 'ran';
        return {
            id: testCase.id,
            label: testCase.label,
            errorClass: testCase.errorClass,
            expectVerdict: testCase.expectVerdict,
            acceptVerdicts: acceptedVerdicts(testCase),
            status: finding.status,
            verdict: ran ? finding.verdict : null,
            flagged: ran ? finding.verdict !== 'entailed' : null,
            exact: ran ? acceptedVerdicts(testCase).includes(finding.verdict) : null,
            ...(finding.detail ? { detail: finding.detail } : {}),
        };
    });
    const ranRows = rows.filter(row => row.status === 'ran');
    const seeded = rows.filter(row => row.label === 'seeded');
    const controls = rows.filter(row => row.label === 'control');
    const seededRan = seeded.filter(row => row.status === 'ran');
    const controlsRan = controls.filter(row => row.status === 'ran');

    const catchRate = { caught: seededRan.filter(row => row.flagged).length, ran: seededRan.length, total: seeded.length };
    catchRate.rate = ratio(catchRate.caught, catchRate.ran);
    const falseAlarm = { alarms: controlsRan.filter(row => row.flagged).length, ran: controlsRan.length, total: controls.length };
    falseAlarm.rate = ratio(falseAlarm.alarms, falseAlarm.ran);
    const exactVerdict = { correct: ranRows.filter(row => row.exact).length, ran: ranRows.length, total: rows.length };
    exactVerdict.rate = ratio(exactVerdict.correct, exactVerdict.ran);

    const byErrorClass = {};
    for (const row of rows) {
        const bucket = byErrorClass[row.errorClass] ||= { total: 0, ran: 0, flagged: 0, exact: 0 };
        bucket.total += 1;
        if (row.status !== 'ran') continue;
        bucket.ran += 1;
        if (row.flagged) bucket.flagged += 1;
        if (row.exact) bucket.exact += 1;
    }

    const checks = {
        catchRate: catchRate.rate === null ? 'not-run' : (catchRate.rate >= targets.catchRate ? 'pass' : 'fail'),
        falseAlarmRate: falseAlarm.rate === null ? 'not-run' : (falseAlarm.rate <= targets.falseAlarmRate ? 'pass' : 'fail'),
    };
    const notRun = rows.filter(row => row.status === 'not-run').map(row => row.id);
    const invalid = rows.filter(row => row.status === 'invalid').map(row => row.id);
    let result = 'pass';
    if (!ranRows.length) result = 'not-run';
    else if (notRun.length || invalid.length) result = 'incomplete';
    else if (checks.catchRate !== 'pass' || checks.falseAlarmRate !== 'pass') result = 'fail';

    return { result, targets, checks, catchRate, falseAlarm, exactVerdict, byErrorClass, notRun, invalid, rows };
}

function pct(rate) {
    return rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`;
}

/** Plain-text report for a score from scoreGroundingEval. */
export function formatScoreTable(score, { variant = '' } = {}) {
    const lines = [];
    lines.push(`Grounding eval score${variant ? ` (variant ${variant})` : ''}: ${score.result.toUpperCase()}`);
    lines.push('');
    lines.push('| Case | Label | Error class | Accepted | Verdict | Flagged | Exact |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of score.rows) {
        const verdict = row.status === 'ran' ? row.verdict : (row.status === 'not-run' ? 'not run' : `invalid: ${row.detail || ''}`);
        const yn = value => (value === null ? '-' : (value ? 'yes' : 'no'));
        lines.push(`| ${row.id} | ${row.label} | ${row.errorClass} | ${row.acceptVerdicts.join(' / ')} | ${verdict} | ${yn(row.flagged)} | ${yn(row.exact)} |`);
    }
    lines.push('');
    lines.push('| Metric | Value | Target | Check |');
    lines.push('| --- | --- | --- | --- |');
    lines.push(`| Catch rate (seeded semantic, verdict != entailed) | ${score.catchRate.caught}/${score.catchRate.ran} = ${pct(score.catchRate.rate)} | >= ${pct(score.targets.catchRate)} | ${score.checks.catchRate} |`);
    lines.push(`| False-alarm rate (controls, verdict != entailed) | ${score.falseAlarm.alarms}/${score.falseAlarm.ran} = ${pct(score.falseAlarm.rate)} | <= ${pct(score.targets.falseAlarmRate)} | ${score.checks.falseAlarmRate} |`);
    lines.push(`| Exact-verdict accuracy (verdict in accepted set) | ${score.exactVerdict.correct}/${score.exactVerdict.ran} = ${pct(score.exactVerdict.rate)} | (reported) | - |`);
    if (score.notRun.length) lines.push('', `Not run (${score.notRun.length}): ${score.notRun.join(', ')}`);
    if (score.invalid.length) lines.push('', `Invalid findings (${score.invalid.length}): ${score.invalid.join(', ')}`);
    return `${lines.join('\n')}\n`;
}
