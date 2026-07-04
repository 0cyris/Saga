/**
 * status.mjs -- Saga loredeck CLI
 * Prints a workshop project's stage, gates, evidence counts, and draft/dist
 * card counts. `--json` emits the structured resume contract for the
 * loredeck-builder skill.
 */

import path from 'node:path';

import { listJsonFilesRecursive, pathExists, readJsonFileOrNull, resolveProjectDir } from '../lib/deck-fs.mjs';
import { collectEvidence, countEvidence } from '../lib/evidence-store.mjs';
import { GATE_BY_STAGE, loadProjectState, summarizeProjectState } from '../lib/project-state.mjs';

async function countDeckCards(deckDir) {
    const manifest = await readJsonFileOrNull(path.join(deckDir, 'loredeck.json'))
        || await readJsonFileOrNull(path.join(deckDir, 'manifest.json'));
    let count = 0;
    for (const file of Array.isArray(manifest?.files) ? manifest.files : []) {
        const json = await readJsonFileOrNull(path.join(deckDir, file));
        count += Array.isArray(json?.entries) ? json.entries.length : 0;
    }
    return count;
}

export async function runStatus({ positionals, flags }) {
    const [projectId] = positionals;
    if (!projectId) throw new Error('Usage: status <project-id> [--json]');
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);

    const collected = await collectEvidence(projectDir, {});
    const evidenceCounts = countEvidence(collected.records);
    const decks = [];
    for (const deck of state.decks || []) {
        decks.push({
            deckId: deck.deckId,
            role: deck.role,
            stage: deck.stage,
            draftCards: await countDeckCards(path.join(projectDir, 'drafts', deck.deckId)),
            promoted: await pathExists(path.join(projectDir, 'dist', deck.deckId, 'loredeck.json')),
            distCards: await countDeckCards(path.join(projectDir, 'dist', deck.deckId)),
        });
    }
    const reviews = (await listJsonFilesRecursive(path.join(projectDir, 'reviews')))
        .map(file => path.basename(file));

    const summary = {
        ...summarizeProjectState(state),
        projectDir,
        pendingGate: GATE_BY_STAGE[state.stage] || null,
        evidence: { ...evidenceCounts, issues: collected.issues.length, scopes: [...new Set(collected.records.map(record => record.scope))] },
        decks,
        healthReports: reviews,
        journalTail: (state.journal || []).slice(-5),
    };

    if (flags.json) {
        console.log(JSON.stringify(summary, null, 2));
        return 0;
    }
    console.log(`Project: ${state.title} (${state.projectId})`);
    console.log(`Stage: ${state.stage}${summary.pendingGate ? ` (pending gate: ${summary.pendingGate})` : ''}`);
    console.log(`Gates approved: ${summary.gatesApproved.join(', ') || '(none)'}`);
    console.log(`Evidence: ${evidenceCounts.accepted} accepted / ${evidenceCounts.pending} pending / ${evidenceCounts.rejected} rejected${collected.issues.length ? ` (${collected.issues.length} validation issues)` : ''}`);
    for (const deck of decks) {
        console.log(`Deck ${deck.deckId} (${deck.role}): ${deck.draftCards} draft cards${deck.promoted ? `, promoted (${deck.distCards} cards in dist)` : ''}`);
    }
    if (summary.journalTail.length) {
        console.log('Recent activity:');
        for (const item of summary.journalTail) console.log(`  ${item.at} ${item.event} ${item.detail}`.trimEnd());
    }
    return 0;
}
