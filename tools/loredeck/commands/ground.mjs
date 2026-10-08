/**
 * ground.mjs -- Saga loredeck CLI
 * `ground check`: verifies that every claim-bearing item carries fact-level
 * support pointers (`<scope>/<recordId>#<factIndex>`) that resolve to accepted
 * evidence facts listed in its evidenceRefs. Exits 1 on any issue. It checks
 * that a claim points at a fact, not that the fact entails the claim.
 */

import { resolveProjectDir } from '../lib/deck-fs.mjs';
import { GROUNDING_STAGES, runGroundCheck } from '../lib/grounding.mjs';
import { loadProjectState } from '../lib/project-state.mjs';

const USAGE = `Usage: ground check <project-id> --stage ${GROUNDING_STAGES.join('|')} [--deck <deck-id>] [--json]`;

export async function runGround({ positionals, flags }) {
    const [action, projectId] = positionals;
    const stage = String(flags.stage || '');
    if (action !== 'check' || !projectId || !GROUNDING_STAGES.includes(stage)) {
        throw new Error(USAGE);
    }
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);
    const deckId = flags.deck ? String(flags.deck) : '';
    const { items, issues } = await runGroundCheck({ stage, state, projectDir, deckId });

    if (flags.json) {
        console.log(JSON.stringify({ ok: !issues.length, stage, deck: deckId || null, checked: items.length, issues }, null, 2));
    } else {
        console.log(`Ground check (${stage}${deckId ? `, deck ${deckId}` : ''}): ${items.length} item(s) checked, ${issues.length} issue(s).`);
        for (const issue of issues) {
            const where = [issue.deck, issue.batch, issue.titleId].filter(Boolean).join('/');
            console.log(`  - [${issue.problem}] ${where}${issue.pointer ? ` ${issue.pointer}` : ''}: ${issue.detail}`);
        }
    }
    return issues.length ? 1 : 0;
}
