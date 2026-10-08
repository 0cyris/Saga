/**
 * audit-findings.mjs -- Saga loredeck CLI
 * Reads the findings files that read-only checker subagents (evidence auditor,
 * grounding verifier) write under reviews/audit/, and renders the short
 * summary that `report` puts at the top of a stage artifact. Findings never
 * block: a missing, empty, or malformed findings file only changes the summary.
 *
 * Findings file shape (spec §9):
 *   { "schemaVersion": 1, "role": "...", "target": "...",
 *     "findings": [{ "ref": "...", "verdict": "...", "note": "..." }] }
 */

import path from 'node:path';

import { listJsonFilesRecursive, pathExists, readJsonFile, toPosixRelative } from './deck-fs.mjs';

export const AUDIT_DIR_REL = 'reviews/audit';

export function auditDir(projectDir) {
    return path.join(projectDir, ...AUDIT_DIR_REL.split('/'));
}

/** Returns a list of shape problems; empty when the findings file is well-formed. */
export function validateFindingsFile(json) {
    const issues = [];
    if (!json || typeof json !== 'object' || Array.isArray(json)) return ['not a JSON object'];
    if (json.schemaVersion !== 1) issues.push('schemaVersion must be 1');
    if (typeof json.role !== 'string' || !json.role.trim()) issues.push('role is required');
    if (typeof json.target !== 'string' || !json.target.trim()) issues.push('target is required');
    if (!Array.isArray(json.findings)) {
        issues.push('findings must be an array');
    } else {
        json.findings.forEach((finding, index) => {
            if (!finding || typeof finding !== 'object') {
                issues.push(`findings[${index}] is not an object`);
                return;
            }
            if (typeof finding.ref !== 'string' || !finding.ref.trim()) issues.push(`findings[${index}].ref is required`);
            if (typeof finding.verdict !== 'string' || !finding.verdict.trim()) issues.push(`findings[${index}].verdict is required`);
        });
    }
    return issues;
}

/**
 * Loads findings files whose name (without .json) starts with `prefix` (and,
 * when `role` is given, whose `role` matches), in sorted order. Each result is `{ file, role, target, findings, issues, stale }`;
 * unreadable or malformed files come back with `issues` set and no findings.
 * With `checkTargets`, a well-formed file whose `target` (project-relative)
 * no longer exists under projectDir comes back with `stale: true`, so a
 * summary can set it aside instead of counting findings for a file that was
 * renamed or deleted. Without it, `stale` is always false.
 */
export async function loadFindingsFiles(projectDir, { prefix = '', role = '', checkTargets = false } = {}) {
    const dir = auditDir(projectDir);
    const files = (await listJsonFilesRecursive(dir))
        .filter(file => path.basename(file, '.json').startsWith(prefix))
        .sort();
    const results = [];
    for (const file of files) {
        const rel = toPosixRelative(projectDir, file);
        let json = null;
        try {
            json = await readJsonFile(file);
        } catch (error) {
            results.push({ file: rel, role: '', target: '', findings: [], issues: [`failed to parse JSON. ${error?.message || ''}`.trim()], stale: false });
            continue;
        }
        const issues = validateFindingsFile(json);
        if (role && !issues.length && json.role !== role) continue;
        const target = String(json?.target || '');
        const stale = Boolean(checkTargets && !issues.length && !await targetExists(projectDir, target));
        results.push({
            file: rel,
            role: String(json?.role || ''),
            target,
            findings: issues.length ? [] : json.findings,
            issues,
            stale,
        });
    }
    return results;
}

/** Whether a findings file's `target` (project-relative) exists on disk. */
async function targetExists(projectDir, target) {
    const trimmed = target.trim();
    if (!trimmed) return false;
    return pathExists(path.resolve(projectDir, ...trimmed.split('/')));
}

function cell(value) {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Renders a markdown summary for the top of a stage artifact.
 * `okVerdicts` are the verdicts that count as passing (e.g. ['supported'] or
 * ['entailed']); every other verdict is listed as flagged. Files marked
 * `stale` (their target no longer exists; see loadFindingsFiles' checkTargets)
 * are listed under "Stale findings files" and left out of the counts.
 * Returns '' when there are no findings files, so artifacts are unchanged
 * until a checker runs.
 */
export function summarizeFindings(loaded, { title = 'Checker findings', okVerdicts = [] } = {}) {
    if (!loaded.length) return '';
    const ok = new Set(okVerdicts);
    const stale = loaded.filter(entry => entry.stale);
    const live = loaded.filter(entry => !entry.stale);
    const all = live.flatMap(entry => entry.findings.map(finding => ({ ...finding, file: entry.file })));
    const flagged = all.filter(finding => !ok.has(finding.verdict));
    const broken = live.filter(entry => entry.issues.length);
    const lines = [`## ${title}`, ''];
    lines.push(`${all.length - flagged.length} verified, ${flagged.length} flagged across ${live.length} findings file(s). Findings are advisory and never block a gate.`);
    if (flagged.length) {
        lines.push('', '| Ref | Verdict | Note | File |', '| --- | --- | --- | --- |');
        for (const finding of flagged) {
            lines.push(`| ${cell(finding.ref)} | ${cell(finding.verdict)} | ${cell(finding.note)} | ${cell(finding.file)} |`);
        }
    }
    if (broken.length) {
        lines.push('', 'Unreadable findings files:');
        for (const entry of broken) lines.push(`- \`${entry.file}\`: ${entry.issues.join('; ')}`);
    }
    if (stale.length) {
        lines.push('', 'Stale findings files (their target no longer exists, so they are not counted above; re-run the checker on the renamed file or delete them):');
        for (const entry of stale) lines.push(`- \`${entry.file}\`: target \`${entry.target}\` is missing`);
    }
    lines.push('');
    return lines.join('\n');
}
