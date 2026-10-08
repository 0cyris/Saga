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

import { listJsonFilesRecursive, readJsonFile, toPosixRelative } from './deck-fs.mjs';

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
 * Loads findings files whose name (without .json) starts with `prefix`, in
 * sorted order. Each result is `{ file, role, target, findings, issues }`;
 * unreadable or malformed files come back with `issues` set and no findings.
 */
export async function loadFindingsFiles(projectDir, { prefix = '' } = {}) {
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
            results.push({ file: rel, role: '', target: '', findings: [], issues: [`failed to parse JSON. ${error?.message || ''}`.trim()] });
            continue;
        }
        const issues = validateFindingsFile(json);
        results.push({
            file: rel,
            role: String(json?.role || ''),
            target: String(json?.target || ''),
            findings: issues.length ? [] : json.findings,
            issues,
        });
    }
    return results;
}

function cell(value) {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/**
 * Renders a markdown summary for the top of a stage artifact.
 * `okVerdicts` are the verdicts that count as passing (e.g. ['supported'] or
 * ['entailed']); every other verdict is listed as flagged. Returns '' when
 * there are no findings files, so artifacts are unchanged until a checker runs.
 */
export function summarizeFindings(loaded, { title = 'Checker findings', okVerdicts = [] } = {}) {
    if (!loaded.length) return '';
    const ok = new Set(okVerdicts);
    const all = loaded.flatMap(entry => entry.findings.map(finding => ({ ...finding, file: entry.file })));
    const flagged = all.filter(finding => !ok.has(finding.verdict));
    const broken = loaded.filter(entry => entry.issues.length);
    const lines = [`## ${title}`, ''];
    lines.push(`${all.length - flagged.length} verified, ${flagged.length} flagged across ${loaded.length} findings file(s). Findings are advisory and never block a gate.`);
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
    lines.push('');
    return lines.join('\n');
}
