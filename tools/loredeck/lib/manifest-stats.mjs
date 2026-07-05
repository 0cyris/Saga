/**
 * manifest-stats.mjs -- Saga loredeck CLI
 * Recomputes manifest stats and the files[] list from a deck folder on disk,
 * and keeps the legacy manifest.json duplicate in sync with loredeck.json.
 *
 * Convention (matches bundled decks): entry files live in subdirectories of
 * the deck folder; root-level .json files are the manifest and registries.
 */

import path from 'node:path';

import {
    listJsonFilesRecursive,
    pathExists,
    readJsonFile,
    toPosixRelative,
    writeJsonFile,
} from './deck-fs.mjs';

export async function collectEntryFilePaths(deckDir) {
    const all = await listJsonFilesRecursive(deckDir);
    return all
        .filter(file => path.dirname(file) !== path.resolve(deckDir))
        .filter(file => !toPosixRelative(deckDir, file).startsWith('assets/'))
        .map(file => toPosixRelative(deckDir, file))
        .sort();
}

export async function readDeckTimelineForStats(deckDir, manifest) {
    const timelineRef = String(manifest?.registries?.timeline || '').trim();
    if (!timelineRef) return { anchors: [], windows: [] };
    const timelinePath = path.join(deckDir, timelineRef);
    if (!(await pathExists(timelinePath))) return { anchors: [], windows: [] };
    let timeline = null;
    try {
        timeline = await readJsonFile(timelinePath);
    } catch (_) {
        return { anchors: [], windows: [] };
    }
    return {
        anchors: Array.isArray(timeline?.anchors) ? timeline.anchors : [],
        windows: [
            ...(Array.isArray(timeline?.windows) ? timeline.windows : []),
            ...(Array.isArray(timeline?.arcs) ? timeline.arcs : []),
            ...(Array.isArray(timeline?.phases) ? timeline.phases : []),
        ],
    };
}

export async function computeDeckStats(deckDir, manifest) {
    const files = Array.isArray(manifest?.files) ? manifest.files : [];
    let entryCount = 0;
    const categoryCounts = {};
    for (const file of files) {
        const filePath = path.join(deckDir, file);
        if (!(await pathExists(filePath))) continue;
        let json = null;
        try {
            json = await readJsonFile(filePath);
        } catch (_) {
            continue;
        }
        for (const entry of Array.isArray(json?.entries) ? json.entries : []) {
            entryCount += 1;
            const category = String(entry?.category || 'other').trim() || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    }
    const { anchors, windows } = await readDeckTimelineForStats(deckDir, manifest);
    return {
        entryCount,
        categoryCounts,
        timelineAnchorCount: anchors.length,
        timelineWindowCount: windows.length,
    };
}

export async function rewriteDeckStats(deckDir, { syncFiles = true } = {}) {
    const manifestPath = path.join(deckDir, 'loredeck.json');
    const manifest = await readJsonFile(manifestPath);
    if (syncFiles) {
        manifest.files = await collectEntryFilePaths(deckDir);
    }
    manifest.stats = await computeDeckStats(deckDir, manifest);
    manifest.updatedAt = new Date().toISOString();
    await writeJsonFile(manifestPath, manifest);
    const duplicatePath = path.join(deckDir, 'manifest.json');
    if (await pathExists(duplicatePath)) {
        await writeJsonFile(duplicatePath, manifest);
    }
    return manifest;
}
