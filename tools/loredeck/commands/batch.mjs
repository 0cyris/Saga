/**
 * batch.mjs -- Saga loredeck CLI
 * Records title/card batch review outcomes in project state.
 */

import { loadProjectState, saveProjectState, setBatchStatus } from '../lib/project-state.mjs';

export async function runBatch({ positionals, flags }) {
    const [action, projectId] = positionals;
    if (action !== 'set' || !projectId || !flags.deck || !flags.kind || !flags.id || !flags.status) {
        throw new Error('Usage: batch set <project-id> --deck <deck-id> --kind titles|cards --id <batch-id> --status draft|approved|rejected [--count N]');
    }
    const state = await loadProjectState(projectId);
    setBatchStatus(state, {
        deckId: String(flags.deck),
        kind: String(flags.kind),
        batchId: String(flags.id),
        status: String(flags.status),
        count: flags.count !== undefined ? Number(flags.count) : null,
    });
    await saveProjectState(state);
    if (flags.json) {
        console.log(JSON.stringify({ ok: true, batches: state.batches }, null, 2));
    } else {
        console.log(`Batch recorded: ${flags.deck}/${flags.kind}/${flags.id} -> ${flags.status}.`);
    }
    return 0;
}
