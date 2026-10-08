/**
 * brief.mjs -- Saga loredeck CLI
 * Prints a complete, self-contained subagent prompt for one dispatch, rendered
 * from the loredeck-builder role templates and current project state (see
 * lib/briefs.mjs). The orchestrator passes the output through unchanged.
 * `--out FILE` writes it to a file instead; `--json` wraps it with metadata.
 */

import path from 'node:path';

import { buildBrief, listBriefRoles } from '../lib/briefs.mjs';
import { writeTextFile } from '../lib/deck-fs.mjs';

export async function runBrief({ positionals, flags }) {
    const [projectId] = positionals;
    if (!projectId) {
        throw new Error(`Usage: brief <project-id> --role ${listBriefRoles().join('|')} --deck <deck-id> [--scope S] [--batch B] [--file F] [--out FILE] [--json]`);
    }
    const brief = await buildBrief({
        projectId,
        role: flags.role,
        deckId: flags.deck,
        flags,
    });

    // Warnings go to stderr so stdout stays the prompt (or the --json object).
    for (const warning of brief.warnings || []) console.error(`WARNING: ${warning}`);

    let outPath = null;
    if (flags.out !== undefined) {
        if (typeof flags.out !== 'string' || !flags.out.trim()) throw new Error('--out needs a file path.');
        outPath = path.resolve(flags.out);
        await writeTextFile(outPath, brief.prompt);
    }

    if (flags.json) {
        console.log(JSON.stringify({ ...brief, out: outPath }, null, 2));
    } else if (outPath) {
        console.log(`Wrote ${brief.role} brief for ${brief.output} to ${outPath}`);
    } else {
        process.stdout.write(brief.prompt);
    }
    return 0;
}
