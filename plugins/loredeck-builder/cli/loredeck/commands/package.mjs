/**
 * package.mjs -- Saga loredeck CLI
 * Builds a .saga-loredeck.zip from a project's promoted dist/ decks using the
 * extension's own zip writer (loredeck-package-service.js), so the artifact
 * matches what Import Deck expects byte-for-byte in structure and safety.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createLoredeckZipPackage } from '../../vendor/loredeck-package-service.js';
import { pathExists, readJsonFile, resolveProjectDir, toPosixRelative } from '../lib/deck-fs.mjs';
import { appendJournal, loadProjectState, saveProjectState } from '../lib/project-state.mjs';

const PACKAGE_SAFE_EXTENSIONS = new Set(['.json', '.png', '.jpg', '.jpeg', '.webp', '.md', '.txt']);

async function listPackageFiles(rootDir) {
    const output = [];
    const walk = async (dir) => {
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) await walk(fullPath);
            else if (item.isFile()) output.push(fullPath);
        }
    };
    await walk(rootDir);
    return output;
}

export async function runPackage({ positionals, flags }) {
    const [projectId] = positionals;
    if (!projectId) throw new Error('Usage: package <project-id> [--out <file.saga-loredeck.zip>] [--author <name>] [--pkg-version <semver>]');
    const state = await loadProjectState(projectId);
    const projectDir = resolveProjectDir(projectId);

    const packagedDecks = [];
    const files = [];
    const skipped = [];
    for (const deck of state.decks || []) {
        const distDir = path.join(projectDir, 'dist', deck.deckId);
        if (!(await pathExists(path.join(distDir, 'loredeck.json')))) continue;
        const manifest = await readJsonFile(path.join(distDir, 'loredeck.json'));
        packagedDecks.push({ deckId: deck.deckId, manifest });
        for (const filePath of await listPackageFiles(distDir)) {
            const relative = toPosixRelative(distDir, filePath);
            if (!PACKAGE_SAFE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
                skipped.push(`${deck.deckId}/${relative}`);
                continue;
            }
            files.push({ path: `loredecks/${deck.deckId}/${relative}`, data: await readFile(filePath) });
        }
    }
    if (!packagedDecks.length) {
        throw new Error('No promoted decks found in dist/. Run promote first.');
    }

    const packageVersion = String(flags['pkg-version'] || '0.1.0');
    const packageMeta = {
        packageSchemaVersion: 1,
        packageType: 'saga_loredeck_package',
        title: state.title,
        description: `Saga Loredeck package for ${state.title}.`,
        author: String(flags.author || ''),
        version: packageVersion,
        deckCount: packagedDecks.length,
    };
    const index = {
        schemaVersion: 2,
        packageType: 'saga_loredeck_index',
        loredecks: packagedDecks.map(({ deckId, manifest }) => ({
            packId: deckId,
            manifest: `${deckId}/loredeck.json`,
            type: 'custom',
            title: manifest.title || deckId,
            ...(manifest.library ? { library: manifest.library } : {}),
            ...(manifest.assets ? { assets: manifest.assets } : {}),
            entrySchemaVersion: manifest.entrySchemaVersion || 3,
            stats: manifest.stats || {},
        })),
        folders: [],
        deckPlacements: [],
    };
    files.unshift(
        { path: 'saga-package.json', data: `${JSON.stringify(packageMeta, null, 2)}\n` },
        { path: 'loredecks/index.json', data: `${JSON.stringify(index, null, 2)}\n` },
    );

    const bytes = await createLoredeckZipPackage(files);
    const outPath = path.resolve(String(
        flags.out || path.join(projectDir, 'dist', `${projectId}-v${packageVersion}.saga-loredeck.zip`),
    ));
    await writeFile(outPath, Buffer.from(bytes));

    appendJournal(state, 'package_built', `${outPath} (${packagedDecks.length} decks)`);
    await saveProjectState(state);

    if (flags.json) {
        console.log(JSON.stringify({
            ok: true,
            outPath,
            decks: packagedDecks.map(deck => deck.deckId),
            fileCount: files.length,
            skipped,
        }, null, 2));
    } else {
        console.log(`Package written: ${outPath}`);
        console.log(`Decks: ${packagedDecks.map(deck => deck.deckId).join(', ')} (${files.length} files).`);
        for (const item of skipped) console.log(`  Skipped non-data file: ${item}`);
        console.log('Next: verify-package, then import in SillyTavern via Loredeck Library > Import Deck.');
    }
    return 0;
}
