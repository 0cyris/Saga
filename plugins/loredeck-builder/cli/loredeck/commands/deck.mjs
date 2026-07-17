/**
 * deck.mjs -- Saga loredeck CLI
 * Adds a deck to an already-initialized workshop project: extends
 * project.json's decks[] and scaffolds the same skeleton deck folder
 * `init` creates for decks declared up front, so a project doesn't need to
 * declare its full roster before starting.
 */

import { resolveProjectDir } from '../lib/deck-fs.mjs';
import { scaffoldDeckFiles } from './init.mjs';
import { addDeckToState, loadProjectState, saveProjectState } from '../lib/project-state.mjs';

function parseDeckSpec(raw) {
    const [deckId, role] = String(raw || '').split(':').map(part => part.trim());
    return { deckId, role: role || 'era' };
}

async function runAdd(projectId, flags) {
    if (!projectId || !flags.deck) {
        throw new Error('Usage: deck add <project-id> --deck <deck-id>:<role>');
    }
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);
    const { deckId, role } = parseDeckSpec(flags.deck);
    const deck = addDeckToState(state, { deckId, role });
    const deckDir = await scaffoldDeckFiles(state, deck, projectDir);
    await saveProjectState(state);
    if (flags.json) {
        console.log(JSON.stringify({ ok: true, deck, deckDir, decks: state.decks }, null, 2));
    } else {
        console.log(`Deck added: ${deck.deckId} (${deck.role}) at ${deckDir}.`);
    }
    return 0;
}

export async function runDeck({ positionals, flags }) {
    const [action, projectId] = positionals;
    if (action === 'add') return runAdd(projectId, flags);
    throw new Error('Usage: deck add <project-id> --deck <deck-id>:<role>');
}
