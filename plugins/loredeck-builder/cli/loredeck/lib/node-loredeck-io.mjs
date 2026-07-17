/**
 * node-loredeck-io.mjs -- Saga loredeck CLI
 * Node filesystem provider for the shared Pack Health code path.
 *
 * The shared module (src/loredecks/loredeck-source-health.js) resolves entry
 * and registry refs with `new URL(ref, baseUrl)`, so this provider works in
 * file:// URL space: deck directories are converted to file:// base URLs and
 * reads go through fs. Read failures mirror the browser fetch result shape
 * so Pack Health issue payloads stay consistent across environments.
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createHealth, finalizeHealth } from '../../vendor/loredeck-health-core.js';
import { loadLoredeckEntryFilesForHealth } from '../../vendor/loredeck-source-health.js';

export async function readJsonDetailedFromFile(url) {
    let filePath = '';
    try {
        filePath = fileURLToPath(url);
    } catch (e) {
        return { ok: false, status: 0, error: e?.message || 'Invalid file URL' };
    }
    let raw = '';
    try {
        raw = await readFile(filePath, 'utf8');
    } catch (e) {
        return { ok: false, status: 0, error: e?.message || 'File read failed' };
    }
    try {
        return { ok: true, json: JSON.parse(raw) };
    } catch (e) {
        return { ok: false, status: 0, error: e?.message || 'Invalid JSON' };
    }
}

export async function readLoredeckManifestFromDir(deckDir) {
    const dir = path.resolve(String(deckDir || ''));
    for (const name of ['loredeck.json', 'manifest.json']) {
        const manifestPath = path.join(dir, name);
        try {
            await stat(manifestPath);
        } catch (_) {
            continue;
        }
        const result = await readJsonDetailedFromFile(pathToFileURL(manifestPath));
        if (!result.ok) {
            throw new Error(`Loredeck manifest failed to parse: ${manifestPath}. ${result.error || ''}`.trim());
        }
        return { manifest: result.json, manifestPath, baseUrl: pathToFileURL(manifestPath) };
    }
    throw new Error(`No loredeck.json or manifest.json found in ${dir}.`);
}

export async function loadLoredeckSourceFromDir(deckDir, options = {}) {
    const { manifest, manifestPath, baseUrl } = await readLoredeckManifestFromDir(deckDir);
    const registryRecord = options.registryRecord || null;
    const externalTagRegistries = options.externalTagRegistries || [];
    const health = createHealth(manifest.id || path.basename(path.resolve(deckDir)));
    const entryFiles = await loadLoredeckEntryFilesForHealth(manifest, baseUrl, health, registryRecord, readJsonDetailedFromFile, externalTagRegistries);
    return {
        manifest,
        manifestPath,
        baseUrl,
        sourceKind: 'directory',
        registryRecord,
        health: finalizeHealth(health),
        entryFiles,
    };
}
