/**
 * evidence.mjs -- Saga loredeck CLI
 * Validates evidence record files and records accept/reject review decisions
 * in the evidence index. Also refreshes the evidence review artifact and the
 * evidence counters in project state.
 */

import path from 'node:path';

import { resolveProjectDir, writeTextFile } from '../lib/deck-fs.mjs';
import { collectEvidence, countEvidence, setEvidenceStatus } from '../lib/evidence-store.mjs';
import { appendJournal, loadProjectState, saveProjectState } from '../lib/project-state.mjs';
import { buildEvidenceArtifact } from '../lib/review-artifacts.mjs';

async function refreshProjectEvidence(state, projectDir) {
    const collected = await collectEvidence(projectDir, {});
    const counts = countEvidence(collected.records);
    state.evidence = {
        scopes: [...new Set(collected.records.map(record => record.scope))].sort(),
        acceptedCount: counts.accepted,
        pendingCount: counts.pending,
        rejectedCount: counts.rejected,
    };
    await writeTextFile(path.join(projectDir, 'reviews', 'evidence.md'), buildEvidenceArtifact(state, collected));
    return { collected, counts };
}

export async function runEvidence({ positionals, flags }) {
    const [action, projectId] = positionals;
    if (!['validate', 'accept', 'reject'].includes(action) || !projectId) {
        throw new Error('Usage: evidence validate|accept|reject <project-id> [--scope <scope>] [--ids a,b|--all] [--note <note>]');
    }
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);

    if (action === 'accept' || action === 'reject') {
        const ids = String(flags.ids || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
        if (!flags.all && !ids.length) {
            throw new Error(`evidence ${action} requires --ids a,b or --all.`);
        }
        const keys = await setEvidenceStatus(projectDir, {
            scope: String(flags.scope || ''),
            ids,
            all: flags.all === true,
            status: action === 'accept' ? 'accepted' : 'rejected',
            note: String(flags.note || ''),
        });
        appendJournal(state, `evidence_${action}ed`, keys.join(', '));
    }

    const { collected, counts } = await refreshProjectEvidence(state, projectDir);
    await saveProjectState(state);

    const scopeFilter = String(flags.scope || '');
    const visibleIssues = scopeFilter
        ? collected.issues.filter(issue => issue.includes(`evidence/${scopeFilter}/`))
        : collected.issues;
    if (scopeFilter && !collected.files.some(file => file.scope === scopeFilter)) {
        visibleIssues.unshift(`No evidence files found for scope "${scopeFilter}". Check the scope name matches an evidence file's "scope" field, or that evidence has been written for it yet.`);
    }

    if (flags.json) {
        console.log(JSON.stringify({ ok: !visibleIssues.length, action, counts, issues: visibleIssues, files: collected.files }, null, 2));
    } else {
        console.log(`Evidence: ${counts.accepted} accepted / ${counts.pending} pending / ${counts.rejected} rejected across ${collected.files.length} files.`);
        if (visibleIssues.length) {
            console.log('Validation issues:');
            for (const issue of visibleIssues) console.log(`  - ${issue}`);
        }
        console.log('Review artifact: reviews/evidence.md');
    }
    return action === 'validate' && visibleIssues.length ? 1 : 0;
}
