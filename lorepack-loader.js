/**
 * lorepack-loader.js -- Saga/Wandlight
 * Minimal Lorepack manifest, entry-file loading, and Pack Health helpers.
 *
 * This module is intentionally data-only: it does not own canon scoring,
 * preprocessing, prompt injection, or UI state.
 */

export const DEFAULT_LOREPACK_ID = 'hp-golden-trio';
export const DEFAULT_LOREPACK_MANIFEST_URL = new URL('./Lorepacks/hp-golden-trio/lorepack.json', import.meta.url);
export const LOREPACK_INDEX_URL = new URL('./Lorepacks/index.json', import.meta.url);
export const LEGACY_LORE_MANIFEST_URL = new URL('./Lore/manifest.json', import.meta.url);
export const LEGACY_LORE_INDEX_URL = new URL('./Lore/index.json', import.meta.url);

export async function fetchJson(url, fallback = null) {
    const result = await fetchJsonDetailed(url);
    return result.ok ? result.json : fallback;
}

async function fetchJsonDetailed(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                statusText: response.statusText || '',
                error: `HTTP ${response.status}`,
            };
        }
        try {
            return { ok: true, json: await response.json() };
        } catch (e) {
            return { ok: false, status: response.status, error: e?.message || 'Invalid JSON' };
        }
    } catch (e) {
        return { ok: false, status: 0, error: e?.message || 'Fetch failed' };
    }
}

function createHealth(packId = '') {
    return {
        schemaVersion: 1,
        packId,
        generatedAt: Date.now(),
        status: 'unknown',
        errors: [],
        warnings: [],
        suggestions: [],
        summary: {
            entryCount: 0,
            fileCount: 0,
            loadedFileCount: 0,
            missingFileCount: 0,
            duplicateEntryIdCount: 0,
            missingEntryIdCount: 0,
            entryOverrideCount: 0,
            entryAdditionCount: 0,
            disabledEntryIdCount: 0,
            suppressedEntryCount: 0,
            categoryCounts: {},
            errorCount: 0,
            warningCount: 0,
            suggestionCount: 0,
        },
    };
}

function addHealthIssue(health, severity, code, message, extra = {}) {
    const issue = {
        code,
        severity,
        message,
        ...extra,
    };
    if (severity === 'error') health.errors.push(issue);
    else if (severity === 'warning') health.warnings.push(issue);
    else health.suggestions.push(issue);
}

function finalizeHealth(health) {
    health.summary.errorCount = health.errors.length;
    health.summary.warningCount = health.warnings.length;
    health.summary.suggestionCount = health.suggestions.length;
    health.status = health.errors.length
        ? 'has_errors'
        : health.warnings.length
            ? 'needs_review'
            : 'good';
    return health;
}

function entryListFromJson(json) {
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json)) return json;
    return [];
}

function analyzeEntries(health, entryFiles = []) {
    const seenIds = new Map();
    const duplicateIds = new Set();
    let missingEntryIds = 0;
    let entryCount = 0;
    const categoryCounts = {};

    for (const fileRecord of entryFiles) {
        for (const entry of fileRecord.entries || []) {
            entryCount += 1;
            const id = String(entry?.id || '').trim();
            if (!id) {
                missingEntryIds += 1;
                addHealthIssue(health, 'error', 'missing_entry_id', `Entry without id in ${fileRecord.file}.`, { file: fileRecord.file });
            } else if (seenIds.has(id)) {
                duplicateIds.add(id);
                addHealthIssue(health, 'error', 'duplicate_entry_id', `Duplicate entry id: ${id}.`, {
                    entryIds: [id],
                    file: fileRecord.file,
                    firstFile: seenIds.get(id),
                });
            } else {
                seenIds.set(id, fileRecord.file);
            }

            const category = String(entry?.category || 'other').trim() || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    }

    health.summary.entryCount = entryCount;
    health.summary.duplicateEntryIdCount = duplicateIds.size;
    health.summary.missingEntryIdCount = missingEntryIds;
    health.summary.categoryCounts = categoryCounts;
}

function buildLorepackMeta(manifest = {}, stackPriority = 100, stackIndex = 0) {
    const id = manifest.id || DEFAULT_LOREPACK_ID;
    return {
        id,
        type: manifest.type || 'bundled',
        title: manifest.title || 'Harry Potter: Golden Trio',
        derivedFrom: manifest.derivedFrom || null,
        disabledEntryIds: Array.isArray(manifest.disabledEntryIds) ? manifest.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : [],
        stackPriority,
        stackIndex,
    };
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function clonePlainObject(value) {
    if (!isPlainObject(value)) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

function buildEmbeddedManifest(registryRecord, packId) {
    if (!isPlainObject(registryRecord?.manifestData)) return null;
    const manifestData = registryRecord.manifestData;
    const id = String(registryRecord.packId || manifestData.id || packId || '').trim();
    if (!id) return null;
    return {
        ...manifestData,
        id,
        type: registryRecord.type || manifestData.type || 'custom',
        title: registryRecord.title || manifestData.title || id,
        description: registryRecord.description || manifestData.description || '',
        fandom: registryRecord.fandom || manifestData.fandom || '',
        era: registryRecord.era || manifestData.era || '',
        author: registryRecord.author || manifestData.author || '',
        version: registryRecord.version || manifestData.version || '',
        source: registryRecord.source || manifestData.source || {},
        tags: Array.isArray(registryRecord.tags) && registryRecord.tags.length ? registryRecord.tags : (manifestData.tags || []),
        stats: registryRecord.stats || manifestData.stats || {},
        derivedFrom: registryRecord.derivedFrom || manifestData.derivedFrom || null,
        disabledEntryIds: Array.isArray(registryRecord.disabledEntryIds) ? registryRecord.disabledEntryIds : [],
    };
}

function normalizeEntryOverrideMap(value) {
    if (!isPlainObject(value)) return new Map();
    const output = new Map();
    for (const [key, raw] of Object.entries(value)) {
        if (!isPlainObject(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        output.set(id, {
            ...clonePlainObject(raw),
            id,
        });
        if (output.size >= 500) break;
    }
    return output;
}

function normalizeDisabledEntryIdSet(value) {
    if (!Array.isArray(value)) return new Set();
    const output = new Set();
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (id) output.add(id);
        if (output.size >= 1000) break;
    }
    return output;
}

function buildOverrideEntry(override, baseEntry, packId, kind) {
    const entry = {
        ...(baseEntry || {}),
        ...(override || {}),
        content: {
            ...(baseEntry?.content || {}),
            ...(override?.content || {}),
        },
        extensions: {
            ...(baseEntry?.extensions || {}),
            ...(override?.extensions || {}),
            sagaLorepackOverride: {
                kind,
                packId,
                sourceEntryId: baseEntry?.id || '',
                updatedAt: override?.extensions?.sagaLorepackOverride?.updatedAt || Date.now(),
            },
        },
        userEditable: override?.userEditable !== false,
        userEdited: true,
    };
    entry.id = String(override?.id || baseEntry?.id || '').trim();
    return entry;
}

function applyRegistryEntryOverrides(entryFiles = [], registryRecord = null, manifest = {}, health = null) {
    const overrides = normalizeEntryOverrideMap(registryRecord?.entryOverrides);
    const disabledIds = normalizeDisabledEntryIdSet(registryRecord?.disabledEntryIds);
    if (!overrides.size && !disabledIds.size) return entryFiles;

    const packId = String(registryRecord?.packId || manifest.id || '').trim();
    const appliedOverrideIds = new Set();
    let replaced = 0;
    let added = 0;
    let suppressed = 0;

    const nextFiles = entryFiles.map(fileRecord => {
        if (!fileRecord?.ok) return fileRecord;
        const nextEntries = [];
        for (const entry of fileRecord.entries || []) {
            const id = String(entry?.id || '').trim();
            if (id && disabledIds.has(id)) {
                suppressed += 1;
                continue;
            }
            if (id && overrides.has(id)) {
                nextEntries.push(buildOverrideEntry(overrides.get(id), entry, packId, 'override'));
                appliedOverrideIds.add(id);
                replaced += 1;
            } else {
                nextEntries.push(entry);
            }
        }
        return {
            ...fileRecord,
            entries: nextEntries,
        };
    });

    const additions = [];
    for (const [id, override] of overrides.entries()) {
        if (appliedOverrideIds.has(id) || disabledIds.has(id)) continue;
        additions.push(buildOverrideEntry(override, null, packId, 'addition'));
        added += 1;
    }
    if (additions.length) {
        nextFiles.push({
            file: '__saga_entry_overrides__',
            url: null,
            ok: true,
            json: { schemaVersion: manifest.entrySchemaVersion || 2, entries: additions },
            entries: additions,
            schemaVersion: manifest.entrySchemaVersion || 2,
        });
    }

    if (health?.summary) {
        health.summary.entryOverrideCount = replaced;
        health.summary.entryAdditionCount = added;
        health.summary.disabledEntryIdCount = disabledIds.size;
        health.summary.suppressedEntryCount = suppressed;
    }
    if (replaced || added || disabledIds.size) {
        addHealthIssue(health, 'suggestion', 'custom_entry_overrides_applied', `Custom Lorepack applied ${replaced} override(s), ${added} addition(s), and ${suppressed} disabled source entr${suppressed === 1 ? 'y' : 'ies'}.`, {
            packId,
            overrideCount: replaced,
            additionCount: added,
            disabledEntryIdCount: disabledIds.size,
            suppressedEntryCount: suppressed,
        });
    }

    return nextFiles;
}

function getLorepackManifestUrl(packId, registryRecord = null) {
    const manifest = String(registryRecord?.manifest || '').trim();
    if (manifest) {
        try {
            return new URL(manifest, import.meta.url);
        } catch (_) {
            return null;
        }
    }
    const id = String(packId || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) return null;
    return new URL(`./Lorepacks/${id}/lorepack.json`, import.meta.url);
}

function getRegistryRecord(registry, packId) {
    const packs = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    return packs[String(packId || '').trim()] || null;
}

function buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex) {
    const id = String(packId || registryRecord?.packId || '').trim();
    return {
        id,
        type: registryRecord?.type || 'custom',
        title: registryRecord?.title || id,
        stackPriority,
        stackIndex,
        source: registryRecord?.source || {},
    };
}

async function loadEntryFiles(manifest = {}, baseUrl, health, registryRecord = null) {
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const entryFiles = [];
    health.summary.fileCount = files.length;

    for (const file of files) {
        const url = new URL(file, baseUrl);
        const result = await fetchJsonDetailed(url);
        if (!result.ok) {
            health.summary.missingFileCount += 1;
            addHealthIssue(health, 'error', 'missing_entry_file', `Lorepack entry file failed to load: ${file}.`, {
                file,
                status: result.status,
                detail: result.error || result.statusText || '',
            });
            entryFiles.push({ file, url, ok: false, entries: [], schemaVersion: 0, error: result.error || '' });
            continue;
        }

        const entries = entryListFromJson(result.json);
        health.summary.loadedFileCount += 1;
        entryFiles.push({
            file,
            url,
            ok: true,
            json: result.json,
            entries,
            schemaVersion: result.json?.schemaVersion || manifest.entrySchemaVersion || 2,
        });
    }

    const finalEntryFiles = applyRegistryEntryOverrides(entryFiles, registryRecord, manifest, health);
    analyzeEntries(health, finalEntryFiles);
    return finalEntryFiles;
}

export async function loadLorepackSourceById(packId = DEFAULT_LOREPACK_ID, options = {}) {
    const registryRecord = options.registryRecord || getRegistryRecord(options.registry, packId);
    const manifestUrl = getLorepackManifestUrl(packId, registryRecord);
    const stackPriority = Number.isFinite(Number(options.stackPriority)) ? Number(options.stackPriority) : 100;
    const stackIndex = Number.isFinite(Number(options.stackIndex)) ? Number(options.stackIndex) : 0;
    const embeddedManifest = buildEmbeddedManifest(registryRecord, packId);
    if (embeddedManifest) {
        const health = createHealth(embeddedManifest.id || packId);
        if (!manifestUrl) {
            addHealthIssue(health, 'error', 'missing_virtual_lorepack_base_manifest', `Custom Lorepack ${embeddedManifest.id || packId} has embedded manifest metadata but no base manifest path for file resolution.`, {
                packId: embeddedManifest.id || packId,
            });
            return {
                manifest: embeddedManifest,
                baseUrl: null,
                sourceKind: 'virtual',
                pack: buildLorepackMeta(embeddedManifest, stackPriority, stackIndex),
                health: finalizeHealth(health),
                entryFiles: [],
            };
        }
        const entryFiles = await loadEntryFiles(embeddedManifest, manifestUrl, health, registryRecord);
        return {
            manifest: embeddedManifest,
            baseUrl: manifestUrl,
            sourceKind: 'virtual',
            pack: {
                ...buildLorepackMeta(embeddedManifest, stackPriority, stackIndex),
                source: embeddedManifest.source || registryRecord?.source || {},
            },
            health: finalizeHealth(health),
            entryFiles,
        };
    }
    if (!manifestUrl) {
        const health = createHealth(packId);
        addHealthIssue(health, 'error', 'invalid_pack_id', `Lorepack id is not a valid bundled pack id: ${packId}.`, { packId });
        return {
            manifest: null,
            baseUrl: null,
            sourceKind: 'missing',
            pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex),
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    const lorepackResult = await fetchJsonDetailed(manifestUrl);
    if (lorepackResult.ok) {
        const manifest = {
            ...(registryRecord || {}),
            ...(lorepackResult.json || {}),
        };
        const pack = {
            ...buildLorepackMeta(manifest, stackPriority, stackIndex),
            source: manifest.source || registryRecord?.source || {},
        };
        const health = createHealth(pack.id);
        const entryFiles = await loadEntryFiles(manifest, manifestUrl, health, registryRecord);
        return {
            manifest,
            baseUrl: manifestUrl,
            sourceKind: 'lorepack',
            pack,
            health: finalizeHealth(health),
            entryFiles,
        };
    }

    if (String(packId || '') !== DEFAULT_LOREPACK_ID || options.allowLegacyFallback === false) {
        const health = createHealth(packId);
        addHealthIssue(health, 'error', 'missing_lorepack_manifest', `Lorepack manifest failed to load for ${packId}.`, {
            packId,
            status: lorepackResult.status,
            detail: lorepackResult.error || lorepackResult.statusText || '',
        });
        return {
            manifest: null,
            baseUrl: manifestUrl,
            sourceKind: 'missing',
            pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex),
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    let legacyResult = await fetchJsonDetailed(LEGACY_LORE_MANIFEST_URL);
    let baseUrl = LEGACY_LORE_MANIFEST_URL;
    if (!legacyResult.ok) {
        legacyResult = await fetchJsonDetailed(LEGACY_LORE_INDEX_URL);
        baseUrl = LEGACY_LORE_INDEX_URL;
    }
    if (!legacyResult.ok) {
        const health = createHealth(DEFAULT_LOREPACK_ID);
        addHealthIssue(health, 'error', 'missing_default_lorepack', 'Default Lorepack and legacy Lore manifest both failed to load.', {
            packId: DEFAULT_LOREPACK_ID,
            status: legacyResult.status,
            detail: legacyResult.error || legacyResult.statusText || '',
        });
        return {
            manifest: null,
            baseUrl,
            sourceKind: 'missing',
            pack: { id: DEFAULT_LOREPACK_ID, type: 'bundled', title: 'Harry Potter: Golden Trio', stackPriority, stackIndex },
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    const manifest = legacyResult.json;
    const health = createHealth(manifest.databaseId || 'legacy-lore');
    const entryFiles = await loadEntryFiles(manifest, baseUrl, health);
    const pack = buildLorepackMeta({
        id: DEFAULT_LOREPACK_ID,
        type: 'bundled',
        title: 'Harry Potter: Golden Trio',
    }, stackPriority, stackIndex);
    return {
        manifest,
        baseUrl,
        sourceKind: 'legacy',
        pack,
        health: finalizeHealth(health),
        entryFiles,
    };
}

function normalizeLorepackStackInput(stack) {
    const input = Array.isArray(stack) && stack.length
        ? stack
        : [{ packId: DEFAULT_LOREPACK_ID, enabled: true, priority: 100, addedAt: 0 }];
    return input
        .map((item, index) => ({
            packId: String(item?.packId || '').trim(),
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
            locked: item?.locked === true,
            addedAt: Number.isFinite(Number(item?.addedAt)) ? Number(item.addedAt) : 0,
            stackIndex: index,
        }))
        .filter(item => item.packId);
}

export async function loadLorepackStackSources(stack, options = {}) {
    const normalized = normalizeLorepackStackInput(stack).filter(item => item.enabled);
    const sources = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index];
        const registryRecord = getRegistryRecord(options.registry, item.packId);
        sources.push(await loadLorepackSourceById(item.packId, {
            registry: options.registry,
            registryRecord,
            stackPriority: item.priority,
            stackIndex: index,
            allowLegacyFallback: options.allowLegacyFallback !== false,
        }));
    }
    return sources;
}

export async function loadDefaultLorepackSource(options = {}) {
    const getStackPriority = typeof options.getStackPriority === 'function'
        ? options.getStackPriority
        : () => 100;
    return loadLorepackSourceById(DEFAULT_LOREPACK_ID, {
        stackPriority: getStackPriority(DEFAULT_LOREPACK_ID),
        stackIndex: 0,
        allowLegacyFallback: options.allowLegacyFallback !== false,
    });
}

export function combineLorepackHealth(sources = []) {
    const health = createHealth('lorepack-stack');
    if (!Array.isArray(sources) || !sources.length) {
        addHealthIssue(health, 'suggestion', 'empty_lorepack_stack', 'No enabled Lorepacks are loaded in the current stack.');
        return finalizeHealth(health);
    }

    for (const source of sources) {
        const sourceHealth = source?.health || {};
        const summary = sourceHealth.summary || {};
        health.summary.entryCount += Number(summary.entryCount) || 0;
        health.summary.fileCount += Number(summary.fileCount) || 0;
        health.summary.loadedFileCount += Number(summary.loadedFileCount) || 0;
        health.summary.missingFileCount += Number(summary.missingFileCount) || 0;
        health.summary.duplicateEntryIdCount += Number(summary.duplicateEntryIdCount) || 0;
        health.summary.missingEntryIdCount += Number(summary.missingEntryIdCount) || 0;
        health.summary.entryOverrideCount = (Number(health.summary.entryOverrideCount) || 0) + (Number(summary.entryOverrideCount) || 0);
        health.summary.entryAdditionCount = (Number(health.summary.entryAdditionCount) || 0) + (Number(summary.entryAdditionCount) || 0);
        health.summary.disabledEntryIdCount = (Number(health.summary.disabledEntryIdCount) || 0) + (Number(summary.disabledEntryIdCount) || 0);
        health.summary.suppressedEntryCount = (Number(health.summary.suppressedEntryCount) || 0) + (Number(summary.suppressedEntryCount) || 0);
        for (const [category, count] of Object.entries(summary.categoryCounts || {})) {
            health.summary.categoryCounts[category] = (health.summary.categoryCounts[category] || 0) + (Number(count) || 0);
        }
        for (const issue of sourceHealth.errors || []) {
            health.errors.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
        for (const issue of sourceHealth.warnings || []) {
            health.warnings.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
        for (const issue of sourceHealth.suggestions || []) {
            health.suggestions.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
    }

    return finalizeHealth(health);
}
