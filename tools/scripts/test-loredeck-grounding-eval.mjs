/**
 * test-loredeck-grounding-eval.mjs -- Saga
 * Deterministic layer of the grounding eval (spec 2026-10-08 §5). Builds a
 * workshop project from the labelled fixtures in fixtures/loredeck-grounding/
 * through the CLI (one card per entry file under drafts/<deck>/eval/), runs
 * `ground check --stage cards --json`, and asserts that every case expected
 * to pass has no issue and every structural case gets exactly its expected
 * problem code. Also checks the fixture set's labelling and the scorer used
 * by the opt-in model layer (loredeck-grounding-eval-model.mjs --score) on a
 * small synthetic set of findings.
 */

import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { GROUNDING_PROBLEMS } from '../loredeck/lib/grounding.mjs';
import { GROUNDING_VERDICTS } from '../loredeck/lib/briefs.mjs';
import {
    buildEvalProject,
    CASE_KINDS,
    CASE_LABELS,
    caseBatch,
    caseHandle,
    caseFindingsRel,
    EVAL_TARGETS,
    formatScoreTable,
    groundCheckCards,
    loadCaseFindings,
    loadEvalCases,
    modelEligible,
    REPO_ROOT,
    scoreGroundingEval,
} from './loredeck-grounding-eval-lib.mjs';

const workshopRoot = path.join(REPO_ROOT, '.tmp', 'test-loredeck-grounding-eval');

// --- The fixture set is labelled consistently ---
const { cases } = await loadEvalCases();
const problemCodes = Object.values(GROUNDING_PROBLEMS);
assert.ok(cases.length >= 18 && cases.length <= 24, `expected about 20 cases, got ${cases.length}`);
assert.equal(new Set(cases.map(testCase => testCase.id)).size, cases.length, 'case ids are unique');
assert.equal(new Set(cases.map(testCase => testCase.card.id)).size, cases.length, 'card ids are unique');
for (const testCase of cases) {
    const where = `case ${testCase.id}`;
    assert.match(testCase.id, /^[a-z0-9][a-z0-9-]*$/, `${where}: id is a slug`);
    assert.ok(CASE_LABELS.includes(testCase.label), `${where}: label`);
    assert.ok(CASE_KINDS.includes(testCase.kind), `${where}: kind`);
    assert.ok(GROUNDING_VERDICTS.includes(testCase.expectVerdict), `${where}: expectVerdict`);
    assert.ok(typeof testCase.errorClass === 'string' && testCase.errorClass, `${where}: errorClass`);
    assert.ok(typeof testCase.note === 'string' && testCase.note, `${where}: note`);
    assert.equal(testCase.card.schemaVersion, 3, `${where}: card is a v3 card`);
    for (const field of ['id', 'title', 'category', 'context', 'content', 'sourceInfo', 'tags']) {
        assert.ok(testCase.card[field] !== undefined, `${where}: card.${field}`);
    }
    if (testCase.kind === 'structural') {
        assert.equal(testCase.label, 'seeded', `${where}: structural cases are seeded`);
        assert.ok(problemCodes.includes(testCase.expectGroundCheck), `${where}: expectGroundCheck is a problem code`);
    } else {
        assert.equal(testCase.expectGroundCheck, 'pass', `${where}: semantic cases pass ground check`);
    }
    if (testCase.label === 'control') {
        assert.equal(testCase.errorClass, 'none', `${where}: controls plant no error`);
        assert.equal(testCase.expectVerdict, 'entailed', `${where}: controls are entailed`);
    } else if (testCase.kind === 'semantic') {
        assert.notEqual(testCase.expectVerdict, 'entailed', `${where}: seeded semantic cases are not entailed`);
    }
}
const count = predicate => cases.filter(predicate).length;
assert.ok(count(testCase => testCase.label === 'control') >= 4, 'at least 4 controls');
assert.ok(count(testCase => testCase.kind === 'structural') >= 4, 'at least 4 structural cases');
assert.ok(count(testCase => testCase.label === 'seeded' && testCase.kind === 'semantic') >= 8, 'at least 8 seeded semantic cases');
for (const errorClass of ['in-universe-span', 'wrong-timing-gate', 'wrong-record', 'unsupported-fact']) {
    assert.ok(count(testCase => testCase.errorClass === errorClass) >= 2, `at least 2 ${errorClass} cases`);
}

// --- Automated layer: ground check flags exactly the structural cases ---
const { cli, projectId, deckId, projectDir } = await buildEvalProject(workshopRoot);
const { code, report } = groundCheckCards(cli, projectId);
assert.equal(code, 1, 'ground check exits 1 because the structural cases are planted');
assert.equal(report.checked, cases.length, 'every case card is checked');
const issuesByBatch = new Map();
for (const issue of report.issues) {
    assert.equal(issue.deck, deckId);
    assert.equal(issue.kind, 'card');
    if (!issuesByBatch.has(issue.batch)) issuesByBatch.set(issue.batch, []);
    issuesByBatch.get(issue.batch).push(issue);
}
const knownBatches = new Set(cases.map(testCase => caseBatch(testCase.id)));
for (const batch of issuesByBatch.keys()) {
    assert.ok(knownBatches.has(batch), `issue for an entry file that is not a case: ${batch}`);
}
for (const testCase of cases) {
    const issues = issuesByBatch.get(caseBatch(testCase.id)) || [];
    if (testCase.expectGroundCheck === 'pass') {
        assert.deepEqual(issues, [], `${testCase.id}: expected no ground-check issue, got ${JSON.stringify(issues)}`);
    } else {
        assert.deepEqual(issues.map(issue => issue.problem), [testCase.expectGroundCheck], `${testCase.id}: expected exactly ${testCase.expectGroundCheck}, got ${JSON.stringify(issues)}`);
        assert.equal(issues[0].itemId, testCase.card.id, `${testCase.id}: issue names the case's card`);
    }
}

// --- Scorer: a synthetic set of findings gives the right rates ---
const synth = [
    { id: 'c1', label: 'control', kind: 'semantic', errorClass: 'none', expectGroundCheck: 'pass', expectVerdict: 'entailed', card: { id: 'card.c1' } },
    { id: 'c2', label: 'control', kind: 'semantic', errorClass: 'none', expectGroundCheck: 'pass', expectVerdict: 'entailed', card: { id: 'card.c2' } },
    { id: 'c3', label: 'control', kind: 'semantic', errorClass: 'none', expectGroundCheck: 'pass', expectVerdict: 'entailed', card: { id: 'card.c3' } },
    { id: 'c4', label: 'control', kind: 'semantic', errorClass: 'none', expectGroundCheck: 'pass', expectVerdict: 'entailed', card: { id: 'card.c4' } },
    { id: 's1', label: 'seeded', kind: 'semantic', errorClass: 'wrong-timing-gate', expectGroundCheck: 'pass', expectVerdict: 'timing-mismatch', card: { id: 'card.s1' } },
    { id: 's2', label: 'seeded', kind: 'semantic', errorClass: 'wrong-timing-gate', expectGroundCheck: 'pass', expectVerdict: 'timing-mismatch', card: { id: 'card.s2' } },
    { id: 's3', label: 'seeded', kind: 'semantic', errorClass: 'unsupported-fact', expectGroundCheck: 'pass', expectVerdict: 'unsupported', card: { id: 'card.s3' } },
    { id: 's4', label: 'seeded', kind: 'semantic', errorClass: 'unsupported-fact', expectGroundCheck: 'pass', expectVerdict: 'unsupported', card: { id: 'card.s4' } },
    { id: 's5', label: 'seeded', kind: 'semantic', errorClass: 'in-universe-span', expectGroundCheck: 'pass', expectVerdict: 'partial', card: { id: 'card.s5' } },
    { id: 'x1', label: 'seeded', kind: 'structural', errorClass: 'missing-support', expectGroundCheck: 'missing-support', expectVerdict: 'unsupported', card: { id: 'card.x1' } },
];
assert.deepEqual(modelEligible(synth).map(testCase => testCase.id), ['c1', 'c2', 'c3', 'c4', 's1', 's2', 's3', 's4', 's5'], 'structural cases are not model-scored');
const ran = verdict => ({ status: 'ran', verdict });
const full = new Map([
    ['c1', ran('entailed')], ['c2', ran('entailed')], ['c3', ran('entailed')], ['c4', ran('partial')],
    ['s1', ran('timing-mismatch')], ['s2', ran('partial')], ['s3', ran('unsupported')], ['s4', ran('entailed')], ['s5', ran('partial')],
    ['x1', ran('entailed')],
]);
const score = scoreGroundingEval(synth, full);
assert.deepEqual([score.catchRate.caught, score.catchRate.ran], [4, 5]);
assert.equal(score.catchRate.rate, 0.8);
assert.deepEqual([score.falseAlarm.alarms, score.falseAlarm.ran], [1, 4]);
assert.equal(score.falseAlarm.rate, 0.25);
assert.deepEqual([score.exactVerdict.correct, score.exactVerdict.ran], [6, 9]);
assert.equal(score.checks.catchRate, 'fail');
assert.equal(score.checks.falseAlarmRate, 'fail');
assert.equal(score.result, 'fail');
assert.deepEqual(score.byErrorClass['wrong-timing-gate'], { total: 2, ran: 2, flagged: 2, exact: 1 });
assert.deepEqual(score.byErrorClass['unsupported-fact'], { total: 2, ran: 2, flagged: 1, exact: 1 });

const perfect = new Map(synth.map(testCase => [testCase.id, ran(testCase.expectVerdict)]));
const perfectScore = scoreGroundingEval(synth, perfect);
assert.equal(perfectScore.catchRate.rate, 1);
assert.equal(perfectScore.falseAlarm.rate, 0);
assert.equal(perfectScore.exactVerdict.rate, 1);
assert.equal(perfectScore.result, 'pass');
assert.deepEqual(EVAL_TARGETS, { catchRate: 0.85, falseAlarmRate: 0.10 });

// Missing findings are "not run": out of the denominators, never failures.
const partial = new Map([['c1', ran('entailed')], ['s1', ran('timing-mismatch')], ['s3', { status: 'invalid', detail: 'not valid JSON' }]]);
const partialScore = scoreGroundingEval(synth, partial);
assert.deepEqual([partialScore.catchRate.caught, partialScore.catchRate.ran, partialScore.catchRate.total], [1, 1, 5]);
assert.deepEqual([partialScore.falseAlarm.alarms, partialScore.falseAlarm.ran], [0, 1]);
assert.deepEqual(partialScore.notRun, ['c2', 'c3', 'c4', 's2', 's4', 's5']);
assert.deepEqual(partialScore.invalid, ['s3']);
assert.equal(partialScore.result, 'incomplete');
const noneScore = scoreGroundingEval(synth, new Map());
assert.equal(noneScore.result, 'not-run');
assert.equal(noneScore.catchRate.rate, null);
assert.equal(noneScore.checks.catchRate, 'not-run');
const table = formatScoreTable(score, { variant: 'a' });
assert.ok(table.includes('variant a') && table.includes('4/5 = 80.0%') && table.includes('1/4 = 25.0%') && table.includes('6/9 = 66.7%'), table);
assert.ok(formatScoreTable(partialScore).includes('Not run (6): c2, c3, c4, s2, s4, s5'));

// --- Findings loader: reads the per-case files the checkers write ---
const eligible = modelEligible(cases);
const [first, second, third, fourth] = eligible;
const writeFindings = async (testCase, body) => {
    const file = path.join(projectDir, ...caseFindingsRel(deckId, testCase.id).split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof body === 'string' ? body : JSON.stringify(body));
};
const findingsFile = (testCase, verdict) => ({
    schemaVersion: 1,
    role: 'grounding-verify',
    target: `drafts/${deckId}/${caseBatch(testCase.id)}.json`,
    findings: [{ ref: testCase.card.id, verdict, note: '' }],
});
assert.equal(caseFindingsRel(deckId, first.id), `reviews/audit/grounding.${deckId}.cards.eval.${caseHandle(first.id)}.json`);
// Case ids name the planted error, so no file name a checker sees may contain one.
for (const testCase of cases) {
    assert.ok(!caseBatch(testCase.id).includes(testCase.id), `${testCase.id}: entry file name must not reveal the case id.`);
    assert.match(caseHandle(testCase.id), /^card-[0-9a-f]{8}$/);
}
assert.equal(new Set(cases.map(testCase => caseHandle(testCase.id))).size, cases.length, 'Case handles must be unique.');
await writeFindings(first, findingsFile(first, first.expectVerdict));
await writeFindings(second, '{ not json');
await writeFindings(third, findingsFile(third, 'maybe'));
await writeFindings(fourth, { ...findingsFile(fourth, 'entailed'), findings: [{ ref: 'some.other.card', verdict: 'entailed' }] });
const loaded = await loadCaseFindings({ projectDir, deckId, cases: eligible });
assert.deepEqual(loaded.get(first.id).status, 'ran');
assert.equal(loaded.get(first.id).verdict, first.expectVerdict);
assert.equal(loaded.get(second.id).status, 'invalid');
assert.match(loaded.get(third.id).detail, /unknown verdict/);
assert.match(loaded.get(fourth.id).detail, /expected exactly one finding/);
assert.equal(loaded.get(eligible[4].id).status, 'not-run');
const loadedScore = scoreGroundingEval(cases, loaded);
assert.equal(loadedScore.result, 'incomplete');
assert.equal(loadedScore.exactVerdict.ran, 1);
assert.equal(loadedScore.rows.length, eligible.length);

await rm(workshopRoot, { recursive: true, force: true });
console.log(`Loredeck grounding eval tests passed (${cases.length} cases: ${eligible.length} model-eligible, ${cases.length - eligible.length} structural).`);
