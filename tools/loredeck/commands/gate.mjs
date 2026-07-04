/**
 * gate.mjs -- Saga loredeck CLI
 * Records an explicit user gate approval and advances the project stage.
 * The skill must only call this after the user has approved the stage's
 * review artifact in chat.
 */

import { GATE_BY_STAGE, approveGate, loadProjectState, saveProjectState } from '../lib/project-state.mjs';

export async function runGate({ positionals, flags }) {
    const [action, projectId] = positionals;
    if (action !== 'approve' || !projectId) {
        throw new Error('Usage: gate approve <project-id> [--note <note>] [--artifact <path>]');
    }
    const state = await loadProjectState(projectId);
    const gate = GATE_BY_STAGE[state.stage];
    approveGate(state, { note: String(flags.note || ''), artifact: String(flags.artifact || '') });
    await saveProjectState(state);
    if (flags.json) {
        console.log(JSON.stringify({ ok: true, approved: gate, stage: state.stage }, null, 2));
    } else {
        console.log(`Gate approved: ${gate}. Project is now at stage: ${state.stage}.`);
    }
    return 0;
}
