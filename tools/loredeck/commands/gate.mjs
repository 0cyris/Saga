/**
 * gate.mjs -- Saga loredeck CLI
 * Records an explicit user gate approval and advances the project stage, or
 * rewinds a project to an earlier stage so a new staged-loop cycle can run
 * (e.g. a family project already at "complete" gaining new decks). The skill
 * must only call `approve` after the user has approved the stage's review
 * artifact in chat, and `reopen` only when the user has confirmed a new
 * cycle is starting.
 *
 * Both subcommands accept an optional --deck <deck-id>, which walks that
 * deck's own per-deck stage (state.decks[].stage) independently of the
 * project-wide state.stage -- for a family project where decks progress on
 * their own cadence. Omitting --deck preserves the original project-wide
 * behavior unchanged.
 */

import { PROJECT_STAGES, appendJournal, approveGate, deckStageIndex, loadProjectState, saveProjectState, setDeckStage, setStage } from '../lib/project-state.mjs';

function findDeck(state, deckId) {
    const deck = (state.decks || []).find(item => item.deckId === deckId);
    if (!deck) throw new Error(`Unknown deck id: ${JSON.stringify(deckId)}.`);
    return deck;
}

async function runApprove(projectId, flags) {
    if (!projectId) {
        throw new Error('Usage: gate approve <project-id> [--deck <deck-id>] [--note <note>] [--artifact <path>]');
    }
    const deckId = String(flags.deck || '');
    const state = await loadProjectState(projectId);
    if (deckId) findDeck(state, deckId); // fail fast with a clear message before approveGate's generic one
    approveGate(state, { note: String(flags.note || ''), artifact: String(flags.artifact || ''), deckId });
    await saveProjectState(state);
    const lastGate = state.gates.at(-1);
    if (deckId) {
        const deck = findDeck(state, deckId);
        if (flags.json) {
            console.log(JSON.stringify({ ok: true, deckId, approved: lastGate.gate, stage: deck.stage }, null, 2));
        } else {
            console.log(`Gate approved for deck ${deckId}: ${lastGate.gate}. Deck is now at stage: ${deck.stage}.`);
        }
    } else if (flags.json) {
        console.log(JSON.stringify({ ok: true, approved: lastGate.gate, stage: state.stage }, null, 2));
    } else {
        console.log(`Gate approved: ${lastGate.gate}. Project is now at stage: ${state.stage}.`);
    }
    return 0;
}

async function runReopen(projectId, flags) {
    const targetStage = String(flags.stage || '');
    if (!projectId || !targetStage) {
        throw new Error('Usage: gate reopen <project-id> --stage <stage> [--deck <deck-id>] [--note <note>]');
    }
    const deckId = String(flags.deck || '');
    const state = await loadProjectState(projectId);
    const toIndex = PROJECT_STAGES.indexOf(targetStage);
    if (toIndex < 0) {
        throw new Error(`Unknown stage: ${JSON.stringify(targetStage)}. One of: ${PROJECT_STAGES.join(', ')}.`);
    }
    if (deckId) {
        const deck = findDeck(state, deckId);
        const fromIndex = deckStageIndex(deck.stage);
        if (toIndex > fromIndex) {
            throw new Error(`gate reopen only rewinds a deck to an earlier or equal stage; use "gate approve --deck ${deckId}" to advance. Deck ${deckId} is at ${JSON.stringify(PROJECT_STAGES[fromIndex])}.`);
        }
        setDeckStage(state, deckId, targetStage);
        if (flags.note) appendJournal(state, 'gate_reopened', `${deckId}: ${flags.note}`);
        await saveProjectState(state);
        if (flags.json) {
            console.log(JSON.stringify({ ok: true, deckId, stage: deck.stage }, null, 2));
        } else {
            console.log(`Deck ${deckId} reopened at stage: ${deck.stage}. Re-run "gate approve --deck ${deckId}" once each stage's work is ready again.`);
        }
        return 0;
    }
    const fromIndex = PROJECT_STAGES.indexOf(state.stage);
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
    throw new Error('Usage: gate approve <project-id> [--deck <deck-id>] [--note <note>] [--artifact <path>]\n   or: gate reopen <project-id> --stage <stage> [--deck <deck-id>] [--note <note>]');
}
