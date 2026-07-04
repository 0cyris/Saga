/**
 * verify-package.mjs -- Saga loredeck CLI
 * Round-trip verification of a .saga-loredeck.zip: parses the archive with
 * the extension's own package parser, then runs Pack Health on every deck
 * from the archived data. Proves the artifact will import cleanly in-app.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { buildLoredeckHealthForData } from '../../vendor/loredeck-health-engine.js';
import { parseLoredeckZipPackage } from '../../vendor/loredeck-package-service.js';

function joinArchivePath(deckRoot, ref) {
    // deckRoot comes from the package parser's dirname() and keeps its
    // trailing slash (e.g. "loredecks/my-deck/"), mirroring joinZipPath.
    const cleanRef = String(ref || '').replace(/\\/g, '/').replace(/^\.\//, '');
    if (cleanRef.startsWith('loredecks/')) return cleanRef;
    return `${deckRoot || ''}${cleanRef}`;
}

export async function verifyLoredeckPackage(zipPath) {
    const bytes = await readFile(zipPath);
    const parsed = await parseLoredeckZipPackage(bytes);
    const problems = [];
    const decks = [];

    for (const failure of parsed.failures) {
        problems.push(`Index record failed to parse: ${failure.error}`);
    }
    for (const deck of parsed.decks) {
        for (const missing of deck.missingFiles) problems.push(`${deck.originalPackId}: missing entry file in archive: ${missing}`);
        for (const missing of deck.missingAssets) problems.push(`${deck.originalPackId}: missing asset in archive: ${missing}`);

        const entryFiles = [];
        for (const ref of Array.isArray(deck.manifest?.files) ? deck.manifest.files : []) {
            const archivePath = joinArchivePath(deck.deckRoot, ref);
            if (!parsed.archive.has(archivePath)) {
                entryFiles.push({ file: ref, ok: false, entries: [], error: 'missing from archive' });
                continue;
            }
            entryFiles.push({ file: ref, ok: true, json: await parsed.archive.readJson(archivePath) });
        }
        const registries = deck.manifest?.registries || {};
        const timelineRef = typeof registries.timeline === 'string' ? registries.timeline : '';
        const tagsRef = typeof registries.tags === 'string' ? registries.tags : '';
        const timeline = timelineRef && parsed.archive.has(joinArchivePath(deck.deckRoot, timelineRef))
            ? await parsed.archive.readJson(joinArchivePath(deck.deckRoot, timelineRef))
            : null;
        const tagRegistry = tagsRef && parsed.archive.has(joinArchivePath(deck.deckRoot, tagsRef))
            ? await parsed.archive.readJson(joinArchivePath(deck.deckRoot, tagsRef))
            : null;
        if (timelineRef && !timeline) problems.push(`${deck.originalPackId}: timeline registry missing from archive: ${timelineRef}`);
        if (tagsRef && !tagRegistry) problems.push(`${deck.originalPackId}: tag registry missing from archive: ${tagsRef}`);

        const health = buildLoredeckHealthForData({
            packId: deck.originalPackId,
            manifest: deck.manifest,
            entryFiles,
            timeline,
            tagRegistry,
        });
        decks.push({ packId: deck.originalPackId, health });
        for (const issue of health.errors) problems.push(`${deck.originalPackId}: [error] ${issue.code}: ${issue.message}`);
        for (const issue of health.warnings) problems.push(`${deck.originalPackId}: [warning] ${issue.code}: ${issue.message}`);
        for (const issue of health.suggestions) problems.push(`${deck.originalPackId}: [suggestion] ${issue.code}: ${issue.message}`);
    }

    return { parsed, decks, problems };
}

export async function runVerifyPackage({ positionals, flags }) {
    const [target] = positionals;
    if (!target) throw new Error('Usage: verify-package <zip-path>');
    const [major] = process.versions.node.split('.').map(Number);
    if (major < 18) throw new Error(`Node 18+ is required to verify packages (found ${process.versions.node}).`);
    const zipPath = path.resolve(target);
    const { parsed, decks, problems } = await verifyLoredeckPackage(zipPath);

    if (flags.json) {
        console.log(JSON.stringify({
            ok: !problems.length,
            deckCount: parsed.deckCount,
            decks: decks.map(deck => ({ packId: deck.packId, status: deck.health.status })),
            problems,
        }, null, 2));
    } else {
        console.log(`Package: ${zipPath}`);
        console.log(`Decks: ${decks.map(deck => `${deck.packId} (${deck.health.status})`).join(', ') || '(none)'}`);
        if (problems.length) {
            console.log(`${problems.length} problem(s):`);
            for (const problem of problems) console.log(`  - ${problem}`);
        } else {
            console.log('Package verifies clean: parses, all files resolve, and every deck has strict-clean Pack Health.');
        }
    }
    return problems.length ? 1 : 0;
}
