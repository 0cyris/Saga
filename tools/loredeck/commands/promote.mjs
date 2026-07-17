/**
 * promote.mjs -- Saga loredeck CLI
 * Promotes drafts/<deck> to dist/<deck>: rewrites stats, requires clean
 * conformance, copies to dist, then requires strict-clean Pack Health
 * (zero errors, warnings, AND suggestions -- the reference bar). A failing
 * deck is removed from dist so dist only ever holds validated decks.
 */

import { cp, rm } from 'node:fs/promises';
import path from 'node:path';

import { pathExists, resolveProjectDir } from '../lib/deck-fs.mjs';
import { rewriteDeckStats } from '../lib/manifest-stats.mjs';
import { appendJournal, loadProjectState, saveProjectState, setDeckStage } from '../lib/project-state.mjs';
import { checkDeckConformance } from './conformance.mjs';
import { runHealthOnDeckDir } from './health.mjs';

export async function runPromote({ positionals, flags }) {
    const [projectId] = positionals;
    if (!projectId) throw new Error('Usage: promote <project-id> [--deck <deck-id>]');
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);
    const decks = (state.decks || []).filter(deck => !flags.deck || deck.deckId === flags.deck);
    if (!decks.length) throw new Error(`No decks matched --deck ${flags.deck} in project ${projectId}.`);

    const results = [];
    let failed = false;
    for (const deck of decks) {
        const draftDir = path.join(projectDir, 'drafts', deck.deckId);
        const distDir = path.join(projectDir, 'dist', deck.deckId);
        const result = { deck: deck.deckId, promoted: false, conformance: null, health: null };
        results.push(result);

        if (!(await pathExists(path.join(draftDir, 'loredeck.json')))) {
            result.error = `No draft deck at ${draftDir}.`;
            failed = true;
            continue;
        }
        await rewriteDeckStats(draftDir);
        const conformance = await checkDeckConformance(draftDir);
        result.conformance = { errors: conformance.errors, warnings: conformance.warnings };
        if (conformance.errors.length) {
            result.error = 'Conformance errors; fix the draft before promoting.';
            failed = true;
            continue;
        }

        await rm(distDir, { recursive: true, force: true });
        await cp(draftDir, distDir, { recursive: true });
        const healthRun = await runHealthOnDeckDir(distDir, {
            strict: true,
            outDir: path.join(projectDir, 'reviews'),
            label: deck.deckId,
        });
        result.health = {
            status: healthRun.health.status,
            errors: healthRun.health.errors.length,
            warnings: healthRun.health.warnings.length,
            suggestions: healthRun.health.suggestions.length,
        };
        if (healthRun.exitCode !== 0) {
            await rm(distDir, { recursive: true, force: true });
            result.error = 'Pack Health is not strict-clean; deck removed from dist. See reviews/health report.';
            failed = true;
            continue;
        }

        result.promoted = true;
        setDeckStage(state, deck.deckId, 'promoted');
    }

    const promotedCount = results.filter(result => result.promoted).length;
    if (promotedCount) {
        appendJournal(state, 'decks_promoted', results.filter(result => result.promoted).map(result => result.deck).join(', '));
    }
    await saveProjectState(state);

    if (flags.json) {
        console.log(JSON.stringify({ ok: !failed, results }, null, 2));
    } else {
        for (const result of results) {
            if (result.promoted) {
                console.log(`Promoted ${result.deck} to dist/ (health: ${result.health.status}).`);
            } else {
                console.log(`FAILED ${result.deck}: ${result.error}`);
                for (const issue of result.conformance?.errors || []) console.log(`  [conformance] ${issue}`);
            }
        }
    }
    return failed ? 1 : 0;
}
