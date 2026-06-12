/**
 * loredeck-manifest-runtime.js - Saga
 * Runtime helpers for loading and adapting Loredeck manifests.
 */

import {
    buildEmbeddedCustomManifest,
} from './loredeck-package-helpers.js';
import {
    isVirtualLoredeckPack,
} from './loredeck-virtual-data.js';

const EXTENSION_ROOT_URL = new URL('../../', import.meta.url);
const BUNDLED_LOREDECKS_ROOT_URL = new URL('content/loredecks/', EXTENSION_ROOT_URL);

export function resolveManifestUrlForFetch(manifestRef) {
    const text = String(manifestRef || '').trim();
    if (!text) return null;
    const normalized = text.replace(/\\/g, '/');
    if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
        const relative = normalized.replace(/^\.?\//, '');
        if (/^content\/loredecks\//i.test(relative)) {
            return new URL(relative.replace(/^content\/loredecks\//i, ''), BUNDLED_LOREDECKS_ROOT_URL);
        }
        if (/^content\//i.test(relative)) {
            return new URL(relative, EXTENSION_ROOT_URL);
        }
    }
    try {
        return new URL(normalized, import.meta.url);
    } catch (_) {
        return null;
    }
}

export async function fetchLoredeckManifest(manifestRef) {
    const url = resolveManifestUrlForFetch(manifestRef);
    if (!url) throw new Error('Manifest path or URL is invalid.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifest failed to load: HTTP ${response.status}`);
    try {
        return await response.json();
    } catch (e) {
        throw new Error(`Manifest is not valid JSON: ${e?.message || 'parse failed'}`);
    }
}

export function buildLoredeckRecordFromManifest(manifest, manifestRef) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('Loredeck manifest must be a JSON object.');
    }
    const packId = String(manifest.id || '').trim();
    if (!packId) throw new Error('Loredeck manifest is missing required id.');
    if (!Array.isArray(manifest.files)) throw new Error('Loredeck manifest is missing required files array.');
    const sourceUrl = String(manifest.source?.url || manifestRef || '').trim();
    const isRemote = /^https?:\/\//i.test(String(manifestRef || ''));
    const manifestType = ['generated', 'custom'].includes(manifest.type) ? manifest.type : 'custom';
    return {
        packId,
        type: manifestType,
        title: String(manifest.title || packId).trim(),
        description: String(manifest.description || '').trim(),
        fandom: String(manifest.fandom || '').trim(),
        era: String(manifest.era || '').trim(),
        author: String(manifest.author || '').trim(),
        version: String(manifest.version || '').trim(),
        entrySchemaVersion: Number.isFinite(Number(manifest.entrySchemaVersion)) ? Number(manifest.entrySchemaVersion) : 0,
        manifest: String(manifestRef || '').trim(),
        source: {
            kind: isRemote ? 'url' : 'path',
            url: sourceUrl,
            updateUrl: String(manifest.update?.url || '').trim(),
        },
        tags: Array.isArray(manifest.tags) ? manifest.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
        stats: {
            entryCount: Number.isFinite(Number(manifest.stats?.entryCount)) ? Math.max(0, Number(manifest.stats.entryCount)) : 0,
            categoryCounts: manifest.stats?.categoryCounts && typeof manifest.stats.categoryCounts === 'object' && !Array.isArray(manifest.stats.categoryCounts)
                ? { ...manifest.stats.categoryCounts }
                : {},
        },
        healthStatus: String(manifest.health?.status || '').trim(),
        installedAt: Date.now(),
        updatedAt: Date.now(),
    };
}

export async function getDisplayManifestForPack(pack, options = {}) {
    if (isVirtualLoredeckPack(pack)) {
        let baseManifest = {};
        if (pack.manifest) {
            baseManifest = await fetchLoredeckManifest(pack.manifest);
        } else if (options.requireFetch !== false) {
            throw new Error('Virtual Custom Loredeck is missing its base manifest path.');
        }
        return buildEmbeddedCustomManifest(
            {
                ...baseManifest,
                ...(pack.manifestData || {}),
            },
            pack
        );
    }
    return fetchLoredeckManifest(pack.manifest);
}
