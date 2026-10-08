/**
 * report.mjs -- Saga loredeck CLI
 * Regenerates the stage review artifact in reviews/ from current project
 * files. Artifacts are the material users review at each gate.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadFindingsFiles, summarizeFindings } from '../lib/audit-findings.mjs';
import { resolveProjectDir, writeTextFile } from '../lib/deck-fs.mjs';
import { acceptedEvidenceKeys, collectEvidence } from '../lib/evidence-store.mjs';
import { runGroundCheck } from '../lib/grounding.mjs';
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
        const { markdown, issues } = buildBriefArtifact(state, briefText);
        await writeTextFile(outPath, markdown);
        extra = { briefIssues: issues.length };
    } else if (stage === 'evidence') {
        const collected = await collectEvidence(projectDir, {});
        await writeTextFile(outPath, buildEvidenceArtifact(state, collected));
        extra = { issues: collected.issues.length };
    } else if (stage === 'plan') {
        await writeTextFile(outPath, await buildPlanArtifact(state, projectDir));
    } else if (stage === 'titles') {
        const groundCheck = await runGroundCheck({ stage: 'titles', state, projectDir });
        // Grounding-verifier findings (reviews/audit/<deck>-titles-<batch>.json),
        // across every deck. Advisory only; '' when no findings file exists.
        const findings = [];
        for (const deck of state.decks || []) {
            findings.push(...await loadFindingsFiles(projectDir, { prefix: `${deck.deckId}-titles-` }));
        }
        const uniqueFindings = [...new Map(findings.map(entry => [entry.file, entry])).values()]
            .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
        const findingsSummary = summarizeFindings(uniqueFindings, { title: 'Grounding checker findings', okVerdicts: ['entailed'] });
        const { markdown, issues } = buildTitlesArtifact(state, groundCheck, { findingsSummary });
        await writeTextFile(outPath, markdown);
        extra = { groundingIssues: issues.length };
    } else if (stage === 'cards') {
        const accepted = await acceptedEvidenceKeys(projectDir);
        const { markdown, duplicates, unbacked, crossDeckCitations } = await buildCardsArtifact(state, projectDir, accepted);
        await writeTextFile(outPath, markdown);
        extra = { duplicates: duplicates.length, unbacked: unbacked.length, crossDeckCitations: crossDeckCitations.length };
        if (flags.verbose) {
            if (flags.json) {
                extra.unbackedCards = unbacked;
                extra.crossDeckCitationDetail = crossDeckCitations;
            } else {
                extra.unbackedLines = unbacked.map(item => `  - ${item.id} (${item.location}): ${item.reason}`);
                extra.crossDeckCitationLines = crossDeckCitations.map(item => `  - ${item.id} (${item.location}): ${item.reason}`);
            }
        }
    } else if (stage === 'final') {
        await writeTextFile(outPath, await buildFinalArtifact(state, projectDir));
    }

    if (flags.json) {
        console.log(JSON.stringify({ ok: true, stage, artifact: outPath, ...(extra || {}) }, null, 2));
    } else {
        console.log(`Review artifact written: ${outPath}`);
        if (extra?.duplicates) console.log(`WARNING: ${extra.duplicates} duplicate card id(s) found.`);
        if (extra?.unbacked) {
            console.log(`WARNING: ${extra.unbacked} card(s) without accepted evidence backing.`);
            for (const line of extra.unbackedLines || []) console.log(line);
        }
        if (extra?.crossDeckCitations) {
            console.log(`WARNING: ${extra.crossDeckCitations} card(s) cite evidence belonging to a different deck.`);
            for (const line of extra.crossDeckCitationLines || []) console.log(line);
        }
        if (extra?.issues) console.log(`WARNING: ${extra.issues} evidence validation issue(s).`);
        if (extra?.groundingIssues) console.log(`WARNING: ${extra.groundingIssues} grounding issue(s); run \`ground check --stage titles\` for details.`);
        if (extra?.briefIssues) console.log(`WARNING: ${extra.briefIssues} scope brief completeness issue(s).`);
    }
    return 0;
}
