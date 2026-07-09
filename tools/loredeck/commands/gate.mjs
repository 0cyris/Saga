/**
 * gate.mjs -- Saga loredeck CLI
 * Records an explicit user gate approval and advances the project stage, or
 * rewinds a project to an earlier stage so a new staged-loop cycle can run
 * (e.g. a family project already at "complete" gaining new decks). The skill
 * must only call `approve` after the user has approved the stage's review
 * artifact in chat, and `reopen` only when the user has confirmed a new
 * cycle is starting.
 */

import { GATE_BY_STAGE, PROJECT_STAGES, appendJournal, approveGate, loadProjectState, saveProjectState, setStage } from '../lib/project-state.mjs';

async function runApprove(projectId, flags) {
    if (!projectId) {
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

async function runReopen(projectId, flags) {
    const targetStage = String(flags.stage || '');
    if (!projectId || !targetStage) {
        throw new Error('Usage: gate reopen <project-id> --stage <stage> [--note <note>]');
    }
    const state = await loadProjectState(projectId);
    const fromIndex = PROJECT_STAGES.indexOf(state.stage);
    const toIndex = PROJECT_STAGES.indexOf(targetStage);
    if (toIndex < 0) {
        throw new Error(`Unknown stage: ${JSON.stringify(targetStage)}. One of: ${PROJECT_STAGES.join(', ')}.`);
    }
    if (toIndex > fromIndex) {
        throw new Error(`gate reopen only rewinds a project to an earlier or equal stage; use "gate approve" to advance. Project is at ${JSON.stringify(state.stage)}.`);
    }
    setStage(state, targetStage);
    if (flags.note) appendJournal(state, 'gate_reopened', String(flags.note));
    await saveProjectState(state);
    if (flags.json) {
        console.log(JSON.stringify({ ok: true, stage: state.stage }, null, 2));
    } else {
        console.log(`Project reopened at stage: ${state.stage}. Re-run "gate approve" once each stage's work is ready again.`);
    }
    return 0;
}

export async function runGate({ positionals, flags }) {
    const [action, projectId] = positionals;
    if (action === 'approve') return runApprove(projectId, flags);
    if (action === 'reopen') return runReopen(projectId, flags);
    throw new Error('Usage: gate approve <project-id> [--note <note>] [--artifact <path>]\n   or: gate reopen <project-id> --stage <stage> [--note <note>]');
}
