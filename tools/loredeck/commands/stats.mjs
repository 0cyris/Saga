/**
 * stats.mjs -- Saga loredeck CLI
 * Recomputes a deck folder's stats and files[] list. Dry-run by default;
 * --write rewrites loredeck.json (and syncs a manifest.json duplicate).
 */

import path from 'node:path';

import { pathExists, readJsonFile } from '../lib/deck-fs.mjs';
import { collectEntryFilePaths, computeDeckStats, rewriteDeckStats } from '../lib/manifest-stats.mjs';

export async function runStats({ positionals, flags }) {
    const [target] = positionals;
    if (!target) throw new Error('Usage: stats <deck-dir> [--write]');
    const deckDir = path.resolve(target);
    const manifestPath = path.join(deckDir, 'loredeck.json');
    if (!(await pathExists(manifestPath))) {
        throw new Error(`No loredeck.json found in ${deckDir}.`);
    }

    if (flags.write) {
        const manifest = await rewriteDeckStats(deckDir);
        if (flags.json) {
            console.log(JSON.stringify({ ok: true, wrote: true, files: manifest.files, stats: manifest.stats }, null, 2));
        } else {
            console.log(`Rewrote stats for ${manifest.id}: ${manifest.stats.entryCount} entries in ${manifest.files.length} files.`);
        }
        return 0;
    }

    const manifest = await readJsonFile(manifestPath);
    const files = await collectEntryFilePaths(deckDir);
    const stats = await computeDeckStats(deckDir, { ...manifest, files });
    const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
    const sortedCounts = (counts) => JSON.stringify(Object.fromEntries(Object.entries(counts || {}).sort()));
    const filesInSync = JSON.stringify(files) === JSON.stringify([...manifestFiles].sort());
    const statsInSync = Number(manifest.stats?.entryCount) === stats.entryCount
        && sortedCounts(manifest.stats?.categoryCounts) === sortedCounts(stats.categoryCounts);
    if (flags.json) {
        console.log(JSON.stringify({ ok: filesInSync && statsInSync, wrote: false, filesInSync, statsInSync, computed: { files, stats } }, null, 2));
    } else {
        console.log(`Computed: ${stats.entryCount} entries in ${files.length} files.`);
        console.log(`Manifest files[] in sync: ${filesInSync ? 'yes' : 'NO'}; stats in sync: ${statsInSync ? 'yes' : 'NO'}.`);
        if (!filesInSync || !statsInSync) console.log('Run with --write to update the manifest.');
    }
    return filesInSync && statsInSync ? 0 : 1;
}
