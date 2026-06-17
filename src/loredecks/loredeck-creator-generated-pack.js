import {
    normalizeLoredeckPendingChanges,
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';

function cloneJson(value) {
    if (!value || typeof value !== 'object') return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

export function normalizeLoredeckCreatorGeneratedPackId(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .slice(0, 96);
}

function normalizeGeneratedTagId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

function parseGeneratedTags(value = '') {
    const seen = new Set();
    const tags = [];
    for (const raw of String(value || '').split(',')) {
        const tag = String(raw || '')
            .trim()
            .replace(/[\r\n]+/g, ' ')
            .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
            .replace(/\s+/g, ' ')
            .slice(0, 64)
            .trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
    }
    return tags;
}

export function getLoredeckCreatorGeneratedPackId(cached = {}) {
    return normalizeLoredeckCreatorGeneratedPackId(cached.generatedPackId || cached.brief?.packId || cached.brief?.title || 'generated-loredeck');
}

export function buildLoredeckCreatorGeneratedTags(brief = {}) {
    const base = ['origin:generated', 'quality:model-drafted', 'saga:creator'];
    const fandom = normalizeGeneratedTagId(`fandom:${brief.fandom || ''}`);
    if (fandom) base.push(fandom);
    return parseGeneratedTags(base.join(', '));
}

export function buildLoredeckCreatorGeneratedManifestSeed(packId = '', brief = {}) {
    return {
        schemaVersion: 3,
        id: packId,
        type: 'generated',
        title: brief.title || packId,
        description: brief.coverage || `Generated Loredeck draft for ${brief.scope || brief.fandom || packId}.`,
        fandom: brief.fandom || '',
        era: brief.scope || '',
        author: 'Saga Deck Maker',
        version: '0.1.0',
        entrySchemaVersion: 3,
        files: [],
        registries: {
            timeline: 'timeline.json',
            tags: 'tags.json',
        },
        tags: buildLoredeckCreatorGeneratedTags(brief),
        stats: {
            entryCount: 0,
            categoryCounts: {},
        },
        health: {
            status: 'draft',
        },
    };
}

export function buildLoredeckCreatorEmbeddedGeneratedManifest(sourceManifest = {}, metadata = {}) {
    const manifest = cloneJson(sourceManifest) || {};
    delete manifest.entries;
    const packId = String(metadata.packId || manifest.id || '').trim();
    manifest.id = packId;
    manifest.type = metadata.type === 'generated' ? 'generated' : 'custom';
    manifest.title = String(metadata.title || manifest.title || packId).trim();
    manifest.description = String(metadata.description || manifest.description || '').trim();
    manifest.fandom = String(metadata.fandom || manifest.fandom || '').trim();
    manifest.era = String(metadata.era || manifest.era || '').trim();
    manifest.author = String(metadata.author || manifest.author || '').trim();
    manifest.version = String(metadata.version || manifest.version || '1.0.0').trim();
    if (Number.isFinite(Number(metadata.entrySchemaVersion)) && Number(metadata.entrySchemaVersion) > 0) {
        manifest.entrySchemaVersion = Number(metadata.entrySchemaVersion);
    }
    manifest.tags = Array.isArray(metadata.tags) ? metadata.tags : (Array.isArray(manifest.tags) ? manifest.tags : []);
    manifest.source = metadata.source || manifest.source || {};
    manifest.update = {
        ...(manifest.update || {}),
        checkForUpdates: false,
        url: '',
    };
    if (metadata.derivedFrom) manifest.derivedFrom = metadata.derivedFrom;
    if (metadata.stats) manifest.stats = metadata.stats;
    if (!Array.isArray(manifest.files)) manifest.files = [];
    return manifest;
}

export function buildLoredeckCreatorGeneratedPackRecord(cached = {}, packId = '', existing = null, options = {}) {
    const brief = cached.brief || {};
    const createUniquePackId = typeof options.createUniquePackId === 'function'
        ? options.createUniquePackId
        : base => normalizeLoredeckCreatorGeneratedPackId(base) || 'generated-loredeck';
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const id = normalizeLoredeckCreatorGeneratedPackId(packId || getLoredeckCreatorGeneratedPackId(cached))
        || createUniquePackId('generated-loredeck');
    const manifestSeed = buildLoredeckCreatorGeneratedManifestSeed(id, brief);
    const record = {
        ...(existing || {}),
        packId: id,
        type: 'generated',
        title: brief.title || existing?.title || id,
        description: brief.coverage || existing?.description || `Generated Loredeck draft for ${brief.scope || brief.fandom || id}.`,
        fandom: brief.fandom || existing?.fandom || '',
        era: brief.scope || existing?.era || '',
        author: existing?.author || 'Saga Deck Maker',
        version: existing?.version || '0.1.0',
        entrySchemaVersion: 3,
        manifest: existing?.manifest || '',
        source: {
            ...(existing?.source || {}),
            kind: 'generated',
            url: '',
            updateUrl: '',
        },
        tags: Array.isArray(existing?.tags) && existing.tags.length ? existing.tags : manifestSeed.tags,
        stats: existing?.stats || manifestSeed.stats,
        healthStatus: existing?.healthStatus || 'draft',
        derivedFrom: existing?.derivedFrom || {
            kind: 'saga_creator',
            title: brief.title || id,
            fandom: brief.fandom || '',
            scope: brief.scope || '',
            granularity: brief.granularity || '',
            createdAt: now,
        },
        entryOverrides: existing?.entryOverrides || {},
        disabledEntryIds: Array.isArray(existing?.disabledEntryIds) ? existing.disabledEntryIds : [],
        tagRegistry: normalizeLoredeckTagRegistry(existing?.tagRegistry),
        timelineRegistry: normalizeLoredeckTimelineRegistry(existing?.timelineRegistry),
        pendingChanges: normalizeLoredeckPendingChanges(existing?.pendingChanges),
        installedAt: existing?.installedAt || now,
        updatedAt: now,
    };
    record.manifestData = buildLoredeckCreatorEmbeddedGeneratedManifest(manifestSeed, record);
    return record;
}
