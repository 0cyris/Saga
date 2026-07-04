/**
 * report.mjs -- Saga loredeck CLI
 * Regenerates the stage review artifact in reviews/ from current project
 * files. Artifacts are the material users review at each gate.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveProjectDir, writeTextFile } from '../lib/deck-fs.mjs';
import { acceptedEvidenceKeys, collectEvidence } from '../lib/evidence-store.mjs';
import { loadProjectState } from '../lib/project-state.mjs';
import {
    buildBriefArtifact,
    buildCardsArtifact,
    buildEvidenceArtifact,
    buildFinalArtifact,
    buildPlanArtifact,
    buildTitlesArtifact,
} from '../lib/review-artifacts.mjs';

const STAGES = ['brief', 'evidence', 'plan', 'titles', 'cards', 'final'];

export async function runReport({ positionals, flags }) {
    const [projectId] = positionals;
    const stage = String(flags.stage || '');
    if (!projectId || !STAGES.includes(stage)) {
        throw new Error(`Usage: report <project-id> --stage ${STAGES.join('|')}`);
    }
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);
    const outPath = path.join(projectDir, 'reviews', `${stage}.md`);
    let extra = null;

    if (stage === 'brief') {
        let briefText = '';
        try {
            briefText = await readFile(path.join(projectDir, 'brief', 'scope-brief.md'), 'utf8');
        } catch (_) {
            briefText = '';
        }
        await writeTextFile(outPath, buildBriefArtifact(state, briefText));
    } else if (stage === 'evidence') {
        const collected = await collectEvidence(projectDir, {});
        await writeTextFile(outPath, buildEvidenceArtifact(state, collected));
        extra = { issues: collected.issues.length };
    } else if (stage === 'plan') {
        await writeTextFile(outPath, await buildPlanArtifact(state, projectDir));
    } else if (stage === 'titles') {
        await writeTextFile(outPath, await buildTitlesArtifact(state, projectDir));
    } else if (stage === 'cards') {
        const accepted = await acceptedEvidenceKeys(projectDir);
        const { markdown, duplicates, unbacked } = await buildCardsArtifact(state, projectDir, accepted);
        await writeTextFile(outPath, markdown);
        extra = { duplicates: duplicates.length, unbacked: unbacked.length };
    } else if (stage === 'final') {
        await writeTextFile(outPath, await buildFinalArtifact(state, projectDir));
    }

    if (flags.json) {
        console.log(JSON.stringify({ ok: true, stage, artifact: outPath, ...(extra || {}) }, null, 2));
    } else {
        console.log(`Review artifact written: ${outPath}`);
        if (extra?.duplicates) console.log(`WARNING: ${extra.duplicates} duplicate card id(s) found.`);
        if (extra?.unbacked) console.log(`WARNING: ${extra.unbacked} card(s) without accepted evidence backing.`);
        if (extra?.issues) console.log(`WARNING: ${extra.issues} evidence validation issue(s).`);
    }
    return 0;
}
