/**
 * lorepack-loader.js -- Saga/Wandlight
 * Minimal Lorepack manifest, entry-file loading, and Pack Health helpers.
 *
 * This module is intentionally data-only: it does not own canon scoring,
 * preprocessing, prompt injection, or UI state.
 */

import { normalizeLoreEntry } from './lore-matrix.js';

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
            timelineAnchorCount: 0,
            timelineWindowCount: 0,
            positionGateCount: 0,
            brokenAnchorReferenceCount: 0,
            invalidPositionWindowCount: 0,
            unmatchablePositionGateCount: 0,
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

function cleanHealthString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanHealthNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function getTimelineRegistryRef(manifest = {}) {
    if (!isPlainObject(manifest)) return '';
    const registries = isPlainObject(manifest.registries) ? manifest.registries : {};
    const refs = [
        registries.timeline,
        registries.storyPosition,
        manifest.timeline,
        isPlainObject(manifest.storyPosition) ? manifest.storyPosition.timeline : '',
        manifest.positionIndex,
    ];
    for (const ref of refs) {
        const cleaned = cleanHealthString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

function normalizeTimelineHealthAnchor(raw = {}, packId = '', index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanHealthString(raw.id || `${packId || 'pack'}.anchor_${index + 1}`, 180);
    if (!id) return null;
    return {
        id,
        label: cleanHealthString(raw.label || raw.title || id, 240),
        sortKey: cleanHealthNumber(raw.sortKey) ?? index + 1,
        arc: cleanHealthString(raw.arc, 180),
        phase: cleanHealthString(raw.phase, 180),
        season: cleanHealthString(raw.season, 80),
        episode: cleanHealthString(raw.episode, 80),
        chapter: cleanHealthString(raw.chapter, 80),
        issue: cleanHealthString(raw.issue, 80),
        quest: cleanHealthString(raw.quest, 180),
        gameStage: cleanHealthString(raw.gameStage, 180),
    };
}

function normalizeTimelineHealthWindow(raw = {}, packId = '', index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanHealthString(raw.id || `${packId || 'pack'}.window_${index + 1}`, 180);
    if (!id) return null;
    return {
        id,
        label: cleanHealthString(raw.label || raw.title || id, 240),
        anchorFrom: cleanHealthString(raw.anchorFrom || raw.from || raw.validFromAnchor, 180),
        anchorTo: cleanHealthString(raw.anchorTo || raw.to || raw.validToAnchor, 180),
        sortKeyFrom: cleanHealthNumber(raw.sortKeyFrom),
        sortKeyTo: cleanHealthNumber(raw.sortKeyTo),
    };
}

function normalizeTimelineRegistryForHealth(raw = {}, packId = '') {
    const input = isPlainObject(raw) ? raw : {};
    const anchors = Array.isArray(input.anchors)
        ? input.anchors.map((anchor, index) => normalizeTimelineHealthAnchor(anchor, packId, index)).filter(Boolean)
        : [];
    const windows = [
        ...(Array.isArray(input.windows) ? input.windows : []),
        ...(Array.isArray(input.arcs) ? input.arcs : []),
        ...(Array.isArray(input.phases) ? input.phases : []),
    ].map((window, index) => normalizeTimelineHealthWindow(window, packId, index)).filter(Boolean);
    return { anchors, windows };
}

function createTimelineHealthIndex(timeline = {}) {
    const anchorById = new Map();
    const duplicateAnchorIds = new Set();
    for (const anchor of timeline.anchors || []) {
        if (!anchor?.id) continue;
        if (anchorById.has(anchor.id)) duplicateAnchorIds.add(anchor.id);
        else anchorById.set(anchor.id, anchor);
    }
    return {
        ...timeline,
        anchorById,
        duplicateAnchorIds,
    };
}

function getAnchorSortKey(timeline = {}, anchorId = '') {
    const anchor = timeline.anchorById?.get(cleanHealthString(anchorId, 180));
    const number = cleanHealthNumber(anchor?.sortKey);
    return number === null ? null : number;
}

function addPositionHealthIssue(health, severity, code, message, extra = {}) {
    if (code === 'broken_anchor_reference') health.summary.brokenAnchorReferenceCount += 1;
    if (code === 'invalid_position_window') health.summary.invalidPositionWindowCount += 1;
    if (code === 'unmatchable_position_gate') health.summary.unmatchablePositionGateCount += 1;
    addHealthIssue(health, severity, code, message, extra);
}

function analyzeTimelineWindowHealth(health, timeline = {}) {
    for (const anchorId of timeline.duplicateAnchorIds || []) {
        addPositionHealthIssue(health, 'warning', 'duplicate_timeline_anchor_id', `Timeline defines duplicate anchor id: ${anchorId}.`, {
            anchorId,
            timelineRef: timeline.timelineRef,
        });
    }

    for (const window of timeline.windows || []) {
        const missingAnchors = [
            window.anchorFrom && !timeline.anchorById.has(window.anchorFrom) ? window.anchorFrom : '',
            window.anchorTo && !timeline.anchorById.has(window.anchorTo) ? window.anchorTo : '',
        ].filter(Boolean);
        if (missingAnchors.length) {
            addPositionHealthIssue(health, 'warning', 'broken_anchor_reference', `Timeline window ${window.id} references unknown anchor${missingAnchors.length === 1 ? '' : 's'}: ${missingAnchors.join(', ')}.`, {
                anchorIds: missingAnchors,
                positionField: 'timelineWindow',
                timelineWindowId: window.id,
                timelineRef: timeline.timelineRef,
            });
        }

        const fromSort = window.sortKeyFrom ?? getAnchorSortKey(timeline, window.anchorFrom);
        const toSort = window.sortKeyTo ?? getAnchorSortKey(timeline, window.anchorTo);
        if (fromSort !== null && toSort !== null && fromSort > toSort) {
            addPositionHealthIssue(health, 'warning', 'invalid_position_window', `Timeline window ${window.id} starts after it ends.`, {
                timelineWindowId: window.id,
                anchorFrom: window.anchorFrom,
                anchorTo: window.anchorTo,
                sortKeyFrom: fromSort,
                sortKeyTo: toSort,
                timelineRef: timeline.timelineRef,
            });
        }
    }
}

async function loadTimelineRegistryForHealth(manifest = {}, baseUrl = null, health) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const timelineRef = getTimelineRegistryRef(manifest);
    const empty = {
        packId,
        timelineRef,
        hasTimelineRef: !!timelineRef,
        anchors: [],
        windows: [],
        anchorById: new Map(),
        duplicateAnchorIds: new Set(),
    };
    if (!timelineRef || !baseUrl) return empty;

    let timelineUrl = null;
    try {
        timelineUrl = new URL(timelineRef, baseUrl);
    } catch (_) {
        addHealthIssue(health, 'warning', 'story_position_timeline_invalid_ref', `Timeline registry path is invalid: ${timelineRef}.`, {
            timelineRef,
        });
        return empty;
    }

    const result = await fetchJsonDetailed(timelineUrl);
    if (!result.ok) {
        addHealthIssue(health, 'warning', 'story_position_timeline_load_failed', `Timeline registry failed to load: ${timelineRef}.`, {
            timelineRef,
            status: result.status,
            detail: result.error || result.statusText || '',
        });
        return empty;
    }

    const timeline = createTimelineHealthIndex({
        ...normalizeTimelineRegistryForHealth(result.json, packId),
        packId,
        timelineRef,
        hasTimelineRef: true,
    });
    health.summary.timelineAnchorCount = timeline.anchors.length;
    health.summary.timelineWindowCount = timeline.windows.length;
    if (!timeline.anchors.length && !timeline.windows.length) {
        addHealthIssue(health, 'suggestion', 'story_position_timeline_empty', `Timeline registry ${timelineRef} has no anchors or windows.`, {
            timelineRef,
        });
    }
    analyzeTimelineWindowHealth(health, timeline);
    return timeline;
}

function hasFinitePositionNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function hasPositionGate(position = {}, coordinates = []) {
    const fields = [
        'anchorId',
        'validFromAnchor',
        'validToAnchor',
        'arc',
        'arcId',
        'phase',
        'phaseId',
        'season',
        'episode',
        'chapter',
        'issue',
        'quest',
        'gameStage',
        'stardateFrom',
        'stardateTo',
    ];
    if (fields.some(field => cleanHealthString(position[field]))) return true;
    if (hasFinitePositionNumber(position.sortKeyFrom) || hasFinitePositionNumber(position.sortKeyTo)) return true;
    return Array.isArray(coordinates) && coordinates.some(item => isPlainObject(item)
        && [item.axis, item.id, item.from, item.to].some(value => cleanHealthString(value)));
}

function getEntryAnchorReferences(position = {}) {
    return [
        ['anchorId', cleanHealthString(position.anchorId, 180)],
        ['validFromAnchor', cleanHealthString(position.validFromAnchor, 180)],
        ['validToAnchor', cleanHealthString(position.validToAnchor, 180)],
    ].filter(([, anchorId]) => anchorId);
}

function hasOnlyAnchorOrWindowPositionGate(position = {}, coordinates = []) {
    const nonAnchorFields = [
        'arc',
        'arcId',
        'phase',
        'phaseId',
        'season',
        'episode',
        'chapter',
        'issue',
        'quest',
        'gameStage',
        'stardateFrom',
        'stardateTo',
    ];
    return getEntryAnchorReferences(position).length > 0
        && !nonAnchorFields.some(field => cleanHealthString(position[field]))
        && (!Array.isArray(coordinates) || coordinates.length === 0);
}

function analyzeEntryPositionWindowHealth(health, entry, file, timeline = {}) {
    const position = entry.position || {};
    const entryId = cleanHealthString(entry.id, 180);
    const invalidReasons = [];

    const explicitFromSort = hasFinitePositionNumber(position.sortKeyFrom) ? Number(position.sortKeyFrom) : null;
    const explicitToSort = hasFinitePositionNumber(position.sortKeyTo) ? Number(position.sortKeyTo) : null;
    const anchorFromSort = getAnchorSortKey(timeline, position.validFromAnchor);
    const anchorToSort = getAnchorSortKey(timeline, position.validToAnchor);
    const fromSort = explicitFromSort ?? anchorFromSort;
    const toSort = explicitToSort ?? anchorToSort;

    if (explicitFromSort !== null && explicitToSort !== null && explicitFromSort > explicitToSort) {
        invalidReasons.push(`sortKeyFrom ${explicitFromSort} is after sortKeyTo ${explicitToSort}`);
    } else if (fromSort !== null && toSort !== null && fromSort > toSort) {
        invalidReasons.push(`from anchor/sort ${fromSort} is after to anchor/sort ${toSort}`);
    }

    if (!invalidReasons.length) return [];

    addPositionHealthIssue(health, 'warning', 'invalid_position_window', `Entry ${entryId || entry.title} has an invalid Story Position window: ${invalidReasons.join('; ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorFrom: position.validFromAnchor || '',
        anchorTo: position.validToAnchor || '',
        sortKeyFrom: fromSort,
        sortKeyTo: toSort,
    });
    return invalidReasons;
}

function analyzeEntryAnchorReferenceHealth(health, entry, file, timeline = {}) {
    const entryId = cleanHealthString(entry.id, 180);
    const missing = [];
    for (const [field, anchorId] of getEntryAnchorReferences(entry.position || {})) {
        if (timeline.anchorById?.has(anchorId)) continue;
        missing.push({ field, anchorId });
    }
    if (!missing.length) return [];

    const anchorIds = missing.map(item => item.anchorId);
    addPositionHealthIssue(health, 'warning', 'broken_anchor_reference', `Entry ${entryId || entry.title} references unknown Story Position anchor${anchorIds.length === 1 ? '' : 's'}: ${anchorIds.join(', ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorIds,
        positionFields: missing.map(item => item.field),
    });
    return missing.map(item => `unknown ${item.field} ${item.anchorId}`);
}

function analyzeEntryPositionHealth(health, entryFiles = [], timeline = {}) {
    let positionGateCount = 0;
    let anchorReferenceGateCount = 0;
    const noTimelineEntryIds = [];

    for (const fileRecord of entryFiles) {
        for (const rawEntry of fileRecord.entries || []) {
            const entry = normalizeLoreEntry(rawEntry);
            const position = entry.position || {};
            const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];
            if (!hasPositionGate(position, coordinates)) continue;

            positionGateCount += 1;
            const entryId = cleanHealthString(entry.id, 180);
            const anchorRefs = getEntryAnchorReferences(position);
            if (anchorRefs.length) anchorReferenceGateCount += 1;
            if (anchorRefs.length && !timeline.hasTimelineRef) {
                if (entryId) noTimelineEntryIds.push(entryId);
                continue;
            }

            const impossibleReasons = [];
            if (timeline.hasTimelineRef) {
                impossibleReasons.push(...analyzeEntryAnchorReferenceHealth(health, entry, fileRecord.file, timeline));
            }
            impossibleReasons.push(...analyzeEntryPositionWindowHealth(health, entry, fileRecord.file, timeline));

            if (impossibleReasons.length && hasOnlyAnchorOrWindowPositionGate(position, coordinates)) {
                addPositionHealthIssue(health, 'warning', 'unmatchable_position_gate', `Entry ${entryId || entry.title} has a Story Position gate that cannot match known anchors: ${impossibleReasons.join('; ')}.`, {
                    entryIds: entryId ? [entryId] : [],
                    file: fileRecord.file,
                    reasons: impossibleReasons,
                });
            }
        }
    }

    health.summary.positionGateCount = positionGateCount;
    if (anchorReferenceGateCount && !timeline.hasTimelineRef) {
        addHealthIssue(health, 'suggestion', 'position_gates_without_timeline', `${anchorReferenceGateCount} entr${anchorReferenceGateCount === 1 ? 'y uses' : 'ies use'} anchor-based Story Position gates, but this Lorepack has no timeline registry.`, {
            entryIds: noTimelineEntryIds.slice(0, 50),
            affectedEntryCount: anchorReferenceGateCount,
        });
    }
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
    const timeline = await loadTimelineRegistryForHealth(manifest, baseUrl, health);
    analyzeEntryPositionHealth(health, finalEntryFiles, timeline);
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
        health.summary.timelineAnchorCount = (Number(health.summary.timelineAnchorCount) || 0) + (Number(summary.timelineAnchorCount) || 0);
        health.summary.timelineWindowCount = (Number(health.summary.timelineWindowCount) || 0) + (Number(summary.timelineWindowCount) || 0);
        health.summary.positionGateCount = (Number(health.summary.positionGateCount) || 0) + (Number(summary.positionGateCount) || 0);
        health.summary.brokenAnchorReferenceCount = (Number(health.summary.brokenAnchorReferenceCount) || 0) + (Number(summary.brokenAnchorReferenceCount) || 0);
        health.summary.invalidPositionWindowCount = (Number(health.summary.invalidPositionWindowCount) || 0) + (Number(summary.invalidPositionWindowCount) || 0);
        health.summary.unmatchablePositionGateCount = (Number(health.summary.unmatchablePositionGateCount) || 0) + (Number(summary.unmatchablePositionGateCount) || 0);
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

export const __lorepackLoaderTestHooks = {
    createHealth,
    finalizeHealth,
    normalizeTimelineRegistryForHealth,
    createTimelineHealthIndex,
    analyzeTimelineWindowHealth,
    analyzeEntryPositionHealth,
};
