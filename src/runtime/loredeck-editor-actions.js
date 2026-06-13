/**
 * loredeck-editor-actions.js - Saga
 * Runtime Loredeck editor command implementations.
 *
 * Keep panel rendering in the caller. This module owns shared command
 * lifecycles for metadata, repair, duplicate, export, and finalization.
 */

import { repairLoredeckEntryForHealth } from '../loredecks/loredeck-loader.js';
import { repairSchemaV3EntryForPack } from '../loredecks/loredeck-schema-v3-entry-repair.js';
import { setLoredeckActionButtonBusy } from '../loredecks/loredeck-action-rows.js';
import {
    buildEmbeddedCustomManifest,
    buildLoredeckStatsFromEntries,
    cloneLoredeckJson,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
    normalizeLoredeckEntryId,
    normalizeLoredeckPackId,
    parseLoredeckTags,
} from './loredeck-package-helpers.js';
import {
    buildLoredeckZipPackageForExport,
} from './loredeck-package-export.js';
import {
    buildLoredeckRecordFromManifest,
    fetchLoredeckManifest,
    getDisplayManifestForPack,
} from './loredeck-manifest-runtime.js';
import {
    getAcceptedGeneratedLoredeckEntries,
    isGeneratedLoredeckPack,
    isVirtualLoredeckPack,
    refreshGeneratedLoredeckDerivedMetadata,
} from './loredeck-virtual-data.js';
import {
    getGeneratedLoredeckExportReadiness,
} from './loredeck-generated-readiness.js';
import {
    createLoredeckRecordPatchChange,
} from './loredeck-pending-change-model.js';

let editorActionDeps = {};

export function configureLoredeckEditorActions(deps = {}) {
    editorActionDeps = { ...editorActionDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof editorActionDeps[name] === 'function' ? editorActionDeps[name] : fallback;
}

function getState() { return dep('getState', () => ({}))(); }
function getLoredeckLibrary(state = getState()) { return dep('getLoredeckLibrary', () => [])(state); }
function getLoredeckDefinition(packId) { return dep('getLoredeckDefinition', () => null)(packId); }
function getFreshLoredeckLibraryPack(packId, fallback = null) { return dep('getFreshLoredeckLibraryPack', getLoredeckDefinition)(packId, fallback); }
function upsertLoredeckLibraryPack(pack) { return dep('upsertLoredeckLibraryPack', () => ({ ok: false, error: 'Loredeck save unavailable.' }))(pack); }
function validateLoredeckForEditor(pack, button = null, options = {}) { return dep('validateLoredeckForEditor', async () => ({}))(pack, button, options); }
function getExpectedLoredeckEntrySchemaVersion(pack, manifest) { return dep('getExpectedLoredeckEntrySchemaVersion', () => 0)(pack, manifest); }
function getLoredeckPendingChanges(pack) { return dep('getLoredeckPendingChanges', () => [])(pack); }
function normalizeLoredeckTagRegistry(value) { return dep('normalizeLoredeckTagRegistry', () => ({ schemaVersion: 1, tags: {} }))(value); }
function normalizeLoredeckTimelineRegistry(value) { return dep('normalizeLoredeckTimelineRegistry', () => ({ schemaVersion: 1, timelineMode: 'hybrid', sortKeyScale: 'pack_local', anchors: [], windows: [] }))(value); }
function clearCanonLoreDatabaseCache() { return dep('clearCanonLoreDatabaseCache')(); }
function clearContextIndexCache() { return dep('clearContextIndexCache')(); }
function refreshLoredeckSurfaces(options) { return dep('refreshLoredeckSurfaces')(options); }
function toast(message, type = 'info') { return dep('toast')(message, type); }
function downloadBytes(bytes, filename, mimeType) { return dep('downloadBytes')(bytes, filename, mimeType); }
function selectLoredeckForDetails(packId, options = {}) { return dep('selectLoredeckForDetails')(packId, options); }
function confirmAction(title, message) { return dep('confirmAction', async () => false)(title, message); }
function createStateBackup(type, details = {}) { return dep('createStateBackup')(type, details); }
function getLoredeckCreatorJobForPack(pack = {}) { return dep('getLoredeckCreatorJobForPack', () => null)(pack); }
function buildLoredeckCreatorCoverageFinalizationProvenance(coverage = {}) { return dep('buildLoredeckCreatorCoverageFinalizationProvenance', () => null)(coverage); }
function openLoredeckMetadataEditor(packId) { return dep('openLoredeckMetadataEditor')(packId); }
function isLoredeckLibraryOpen() { return dep('isLoredeckLibraryOpen', () => false)(); }
function renderLoredeckLibraryOverlay() { return dep('renderLoredeckLibraryOverlay')(); }
function addLoredeckToStack(packId) { return dep('addLoredeckToStack')(packId); }
function setLoredeckManifestPreviewCacheRecord(packId, record = null) { return dep('setLoredeckManifestPreviewCacheRecord')(packId, record); }
function deleteLoredeckManifestPreviewCacheRecord(packId) { return dep('deleteLoredeckManifestPreviewCacheRecord')(packId); }
function deleteLoredeckEntryPreviewCacheRecord(packId) { return dep('deleteLoredeckEntryPreviewCacheRecord')(packId); }
function deleteLoredeckTimelineRegistryCacheRecord(packId) { return dep('deleteLoredeckTimelineRegistryCacheRecord')(packId); }
function deleteLoredeckTagRegistryCacheRecord(packId) { return dep('deleteLoredeckTagRegistryCacheRecord')(packId); }

function getSafeRepairHealthCount(health = null, key = '') {
    return Number(health?.summary?.[key]) || 0;
}

function formatSafeRepairHealthDelta(beforeHealth = null, afterHealth = null) {
    if (!beforeHealth || !afterHealth) return 'stats refreshed';
    const beforeErrors = getSafeRepairHealthCount(beforeHealth, 'errorCount');
    const afterErrors = getSafeRepairHealthCount(afterHealth, 'errorCount');
    const beforeWarnings = getSafeRepairHealthCount(beforeHealth, 'warningCount');
    const afterWarnings = getSafeRepairHealthCount(afterHealth, 'warningCount');
    return `Pack Health ${beforeErrors}->${afterErrors} error${afterErrors === 1 ? '' : 's'}, ${beforeWarnings}->${afterWarnings} warning${afterWarnings === 1 ? '' : 's'}`;
}

function getSchemaV3RepairCandidateKey(entryId = '', candidate = {}) {
    const to = candidate.to || (Array.isArray(candidate.candidates) ? candidate.candidates.join(',') : '');
    return [
        String(entryId || '').trim(),
        String(candidate.kind || '').trim(),
        String(candidate.field || '').trim(),
        String(candidate.from || '').trim(),
        String(to || '').trim(),
    ].join('|');
}

function getExistingSchemaV3RepairCandidateKeys(pack = {}) {
    const keys = new Set();
    for (const change of getLoredeckPendingChanges(pack)) {
        if (change.source !== 'safe_repair' || change.action !== 'review_schema_v3_context_anchor') continue;
        const entryId = String(change.affectedEntryIds?.[0] || '').trim();
        const candidates = Array.isArray(change.preview?.schemaV3RepairCandidates)
            ? change.preview.schemaV3RepairCandidates
            : [];
        for (const candidate of candidates) keys.add(getSchemaV3RepairCandidateKey(entryId, candidate));
    }
    return keys;
}

function buildSchemaV3ContextAnchorRepairChange(entry = {}, candidates = [], existingKeys = new Set()) {
    const entryId = String(entry?.id || '').trim();
    if (!entryId) return null;
    const concreteCandidates = [];
    const nextContext = {
        ...(entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {}),
    };
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
        if (candidate?.kind !== 'context_anchor' || !candidate.field || !candidate.to) continue;
        const key = getSchemaV3RepairCandidateKey(entryId, candidate);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        concreteCandidates.push(candidate);
        nextContext[candidate.field] = candidate.to;
    }
    if (!concreteCandidates.length) return null;
    const nextEntry = cloneLoredeckJson({
        ...entry,
        context: nextContext,
        userEdited: true,
    }) || {
        ...entry,
        context: nextContext,
        userEdited: true,
    };
    const before = concreteCandidates.map(candidate => `${candidate.field}: ${candidate.from}`).join(', ');
    const after = concreteCandidates.map(candidate => `${candidate.field}: ${candidate.to}`).join(', ');
    return createLoredeckRecordPatchChange({
        source: 'safe_repair',
        action: 'review_schema_v3_context_anchor',
        targetKind: 'entry',
        title: `Review Context anchor repair: ${entry.title || entryId}`,
        description: `Proposes Context anchor replacements inferred from exact sort-key matches. Review before accepting because anchor semantics can be story-sensitive.`,
        affectedEntryIds: [entryId],
        affectedTimelineIds: concreteCandidates.flatMap(candidate => [candidate.from, candidate.to]),
        payload: {
            entryOverrides: {
                [entryId]: nextEntry,
            },
            disabledEntryIdsRemove: [entryId],
        },
        preview: {
            before,
            after,
            schemaV3RepairCandidates: concreteCandidates,
            healthIssueCode: 'broken_anchor_reference',
        },
    });
}

export async function repairLoredeckSafeHealthIssues(pack, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Repairing...', { fallbackLabel: 'Auto-Repair Safe Findings' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be repaired directly. Duplicate as Custom first.', 'warning');
            return false;
        }
        const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: false });
        if (!validation.health) throw new Error(validation.error || 'Validation failed before repair.');
        const summary = validation.health.summary || {};
        const entrySchemaVersion = getExpectedLoredeckEntrySchemaVersion(fresh, validation.manifest);
        const next = {
            ...fresh,
            entrySchemaVersion,
            healthStatus: validation.health.status,
            stats: {
                entryCount: Number(summary.entryCount) || 0,
                categoryCounts: summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
                    ? { ...summary.categoryCounts }
                    : {},
            },
            entryOverrides: { ...(fresh.entryOverrides || {}) },
            disabledEntryIds: Array.isArray(fresh.disabledEntryIds) ? [...fresh.disabledEntryIds] : [],
            localModified: true,
            updatedAt: Date.now(),
        };

        let overrideRepairCount = 0;
        let unresolvedRepairCount = 0;
        let ambiguousRepairCandidateCount = 0;
        const pendingRepairChanges = [];
        const existingRepairCandidateKeys = getExistingSchemaV3RepairCandidateKeys(next);
        if (entrySchemaVersion >= 3) {
            for (const [id, raw] of Object.entries(next.entryOverrides || {})) {
                const base = repairLoredeckEntryForHealth(raw, { forceSchemaVersion: 3 });
                const repair = repairSchemaV3EntryForPack(next, base, id, {
                    rejectUnknownAnchors: false,
                    rejectUnknownTags: false,
                });
                const repaired = repair.entry;
                if (JSON.stringify(repaired) !== JSON.stringify(raw)) {
                    next.entryOverrides[id] = repaired;
                    overrideRepairCount += 1;
                }
                if (repair.unresolved.length || repair.errors.length) unresolvedRepairCount += 1;
                ambiguousRepairCandidateCount += repair.reviewCandidates.filter(candidate => !candidate.to).length;
                const pendingRepair = buildSchemaV3ContextAnchorRepairChange(repaired, repair.reviewCandidates, existingRepairCandidateKeys);
                if (pendingRepair) pendingRepairChanges.push(pendingRepair);
            }
        }
        if (pendingRepairChanges.length) {
            next.pendingChanges = [
                ...getLoredeckPendingChanges(next),
                ...pendingRepairChanges,
            ];
        }
        const changedCount = overrideRepairCount + pendingRepairChanges.length;
        if (!changedCount) {
            const reviewParts = [
                ambiguousRepairCandidateCount ? `${ambiguousRepairCandidateCount} ambiguous candidate${ambiguousRepairCandidateCount === 1 ? '' : 's'}` : '',
                unresolvedRepairCount ? `${unresolvedRepairCount} override${unresolvedRepairCount === 1 ? '' : 's'} still need review` : '',
            ].filter(Boolean);
            toast(reviewParts.length
                ? `No deterministic safe repairs were applied. ${reviewParts.join(', ')}. Use assistant batches or manual review for the remaining Pack Health findings.`
                : 'No deterministic safe repairs are available for this Loredeck. Use assistant batches or manual review for the remaining Pack Health findings.',
            reviewParts.length ? 'warning' : 'info');
            return false;
        }
        if (isGeneratedLoredeckPack(next)) {
            refreshGeneratedLoredeckDerivedMetadata(next);
        } else if (isVirtualLoredeckPack(next)) {
            next.manifestData = buildEmbeddedCustomManifest(next.manifestData || validation.manifest, next);
        }
        const result = upsertLoredeckLibraryPack(next);
        if (!result.ok) throw new Error(result.error || 'Safe repair failed.');
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        deleteLoredeckEntryPreviewCacheRecord(next.packId);
        const afterValidation = await validateLoredeckForEditor(next, null, { quiet: true, updateLibrary: true });
        refreshLoredeckSurfaces();
        toast(`Safe repairs applied: ${formatSafeRepairHealthDelta(validation.health, afterValidation?.health)}${overrideRepairCount ? `, ${overrideRepairCount} override${overrideRepairCount === 1 ? '' : 's'} repaired` : ''}${pendingRepairChanges.length ? `, ${pendingRepairChanges.length} review repair${pendingRepairChanges.length === 1 ? '' : 's'} queued` : ''}${ambiguousRepairCandidateCount ? `, ${ambiguousRepairCandidateCount} ambiguous candidate${ambiguousRepairCandidateCount === 1 ? '' : 's'} left for Pack Health review` : ''}${unresolvedRepairCount ? `, ${unresolvedRepairCount} override${unresolvedRepairCount === 1 ? '' : 's'} still need review` : ''}.`, 'success');
        return true;
    } catch (e) {
        toast(e?.message || 'Safe repair failed.', 'error');
        return false;
    } finally {
        restoreBusy();
    }
}

export async function exportValidatedLoredeckDraft(pack, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Exporting...', { fallbackLabel: 'Export Package' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack) || pack;
        const packageResult = await buildLoredeckZipPackageForExport([fresh]);
        downloadBytes(packageResult.zipBytes, packageResult.filename, 'application/zip');
        toast(`Loredeck package exported with ${packageResult.fileCount} file${packageResult.fileCount === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck export failed.', 'error');
    } finally {
        restoreBusy();
    }
}

export async function syncLoredeckMetadataFromManifest(pack, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Syncing...', { fallbackLabel: 'Sync From Manifest' });
    try {
        if (isVirtualLoredeckPack(pack)) {
            const baseManifest = await fetchLoredeckManifest(pack.manifest);
            const record = {
                ...pack,
                type: 'custom',
                entrySchemaVersion: Number.isFinite(Number(baseManifest.entrySchemaVersion)) ? Number(baseManifest.entrySchemaVersion) : (Number(pack.entrySchemaVersion) || 0),
                stats: {
                    entryCount: Number.isFinite(Number(baseManifest.stats?.entryCount)) && Number(baseManifest.stats.entryCount) > 0
                        ? Math.max(0, Number(baseManifest.stats.entryCount))
                        : Math.max(0, Number(pack.entryCount || pack.stats?.entryCount) || 0),
                    categoryCounts: baseManifest.stats?.categoryCounts && typeof baseManifest.stats.categoryCounts === 'object' && !Array.isArray(baseManifest.stats.categoryCounts)
                        ? { ...baseManifest.stats.categoryCounts }
                        : (pack.stats?.categoryCounts || {}),
                },
            };
            record.manifestData = buildEmbeddedCustomManifest(baseManifest, record);
            if (getLoredeckTimelineRegistryCount(pack.timelineRegistry)) record.timelineRegistry = normalizeLoredeckTimelineRegistry(pack.timelineRegistry);
            if (getLoredeckTagRegistryCount(pack.tagRegistry)) record.tagRegistry = normalizeLoredeckTagRegistry(pack.tagRegistry);
            const result = upsertLoredeckLibraryPack(record);
            if (!result.ok) throw new Error(result.error || 'Metadata sync failed.');
            setLoredeckManifestPreviewCacheRecord(record.packId, {
                manifest: record.manifestData,
                error: '',
                loadedAt: Date.now(),
            });
            refreshLoredeckSurfaces({ clearCanon: true });
            toast(`${record.title} refreshed from its base manifest.`, 'success');
            return;
        }
        const manifest = await fetchLoredeckManifest(pack.manifest);
        const record = buildLoredeckRecordFromManifest(manifest, pack.manifest);
        if (record.packId !== pack.packId) {
            throw new Error(`Manifest id ${record.packId} does not match selected Loredeck id ${pack.packId}. Register it as a separate Loredeck instead.`);
        }
        record.type = pack.type === 'generated' ? 'generated' : 'custom';
        record.installedAt = pack.installedAt || Date.now();
        record.entryOverrides = pack.entryOverrides || {};
        record.disabledEntryIds = Array.isArray(pack.disabledEntryIds) ? [...pack.disabledEntryIds] : [];
        record.localModified = pack.localModified === true;
        const pendingChanges = getLoredeckPendingChanges(pack);
        if (pendingChanges.length) record.pendingChanges = pendingChanges;
        if (getLoredeckTimelineRegistryCount(pack.timelineRegistry)) record.timelineRegistry = normalizeLoredeckTimelineRegistry(pack.timelineRegistry);
        if (getLoredeckTagRegistryCount(pack.tagRegistry)) record.tagRegistry = normalizeLoredeckTagRegistry(pack.tagRegistry);
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Metadata sync failed.');
        setLoredeckManifestPreviewCacheRecord(record.packId, {
            manifest,
            error: '',
            loadedAt: Date.now(),
        });
        selectLoredeckForDetails(record.packId, { refresh: false });
        clearCanonLoreDatabaseCache();
        refreshLoredeckSurfaces();
        toast(`${record.title} metadata synced from manifest.`, 'success');
    } catch (e) {
        toast(e?.message || 'Metadata sync failed.', 'error');
    } finally {
        restoreBusy();
    }
}

export async function saveLoredeckMetadataFromInputs(pack, fields, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Saving...', { fallbackLabel: 'Save Metadata' });
    try {
        const title = fields.titleInput.value.trim() || pack.title || pack.packId;
        const nextManifest = fields.manifestInput.value.trim();
        if (nextManifest && nextManifest !== pack.manifest) {
            const manifest = await fetchLoredeckManifest(nextManifest);
            const manifestId = String(manifest?.id || '').trim();
            if (!manifestId) throw new Error('Manifest is missing required id.');
            if (manifestId !== pack.packId) {
                throw new Error(`Manifest id ${manifestId} does not match selected Loredeck id ${pack.packId}. Register it as a separate Loredeck instead.`);
            }
            setLoredeckManifestPreviewCacheRecord(pack.packId, {
                manifest,
                error: '',
                loadedAt: Date.now(),
            });
        }
        const record = {
            ...pack,
            type: pack.type === 'generated' ? 'generated' : 'custom',
            title,
            description: fields.descriptionInput.value.trim(),
            fandom: fields.fandomInput.value.trim(),
            era: fields.eraInput.value.trim(),
            author: fields.authorInput.value.trim(),
            version: fields.versionInput.value.trim(),
            manifest: nextManifest,
            tags: parseLoredeckTags(fields.tagsInput.value),
            localModified: true,
            updatedAt: Date.now(),
        };
        if (isGeneratedLoredeckPack(record)) {
            refreshGeneratedLoredeckDerivedMetadata(record);
        } else if (isVirtualLoredeckPack(pack)) {
            record.manifestData = buildEmbeddedCustomManifest(pack.manifestData, record);
        }
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Loredeck metadata save failed.');
        if (record.manifest !== pack.manifest) {
            deleteLoredeckManifestPreviewCacheRecord(pack.packId);
            deleteLoredeckEntryPreviewCacheRecord(pack.packId);
            deleteLoredeckTimelineRegistryCacheRecord(pack.packId);
            deleteLoredeckTagRegistryCacheRecord(pack.packId);
        }
        clearCanonLoreDatabaseCache();
        refreshLoredeckSurfaces();
        toast(`${title} metadata saved.`, 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck metadata save failed.', 'error');
    } finally {
        restoreBusy();
    }
}

export function getUniqueLoredeckPackId(baseId, library = getLoredeckLibrary(getState())) {
    const existing = new Set(library.map(pack => pack.packId));
    const base = normalizeLoredeckPackId(baseId) || 'custom-loredeck';
    if (!existing.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base}-${index}`;
        if (!existing.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}

export function getDefaultDuplicateLoredeckTags(pack, manifest = {}) {
    const sourceTags = Array.isArray(pack?.tags) && pack.tags.length ? pack.tags : (Array.isArray(manifest.tags) ? manifest.tags : []);
    return parseLoredeckTags([
        ...sourceTags.filter(tag => !String(tag || '').toLowerCase().startsWith('quality:')),
        'origin:duplicate',
        'quality:user-managed',
    ].join(', '));
}

export function getLoredeckDuplicateTitle(sourcePack = {}, suffix = 'Copy') {
    const title = String(sourcePack.title || sourcePack.packId || 'Loredeck').trim();
    const cleanSuffix = String(suffix || 'Copy').trim() || 'Copy';
    return /\bcopy(?:\s+\d+)?$/i.test(title) ? title : `${title} ${cleanSuffix}`;
}

export async function buildCustomDuplicateLoredeckRecord(sourcePack, options = {}) {
    const packId = normalizeLoredeckPackId(options.packId);
    if (!packId) throw new Error('Custom Loredeck needs a valid pack ID.');
    if (getLoredeckDefinition(packId)) throw new Error(`A Loredeck with id ${packId} already exists.`);
    const title = String(options.title || sourcePack.title || packId).trim() || packId;
    const sourceManifest = await getDisplayManifestForPack(sourcePack);
    const baseManifest = sourcePack.manifest || sourcePack.source?.url || '';
    if (!baseManifest) throw new Error('Source Loredeck does not have a fetchable manifest path.');
    const stats = {
        entryCount: Number.isFinite(Number(sourcePack.entryCount)) ? Math.max(0, Number(sourcePack.entryCount)) : (Number(sourceManifest.stats?.entryCount) || 0),
        categoryCounts: sourceManifest.stats?.categoryCounts && typeof sourceManifest.stats.categoryCounts === 'object' && !Array.isArray(sourceManifest.stats.categoryCounts)
            ? { ...sourceManifest.stats.categoryCounts }
            : (sourcePack.stats?.categoryCounts || {}),
    };
    const derivedFrom = {
        packId: sourcePack.packId,
        title: sourcePack.title || sourcePack.packId,
        type: sourcePack.type || 'custom',
        version: sourcePack.version || sourceManifest.version || '',
        manifest: baseManifest,
        duplicatedAt: Date.now(),
    };
    const record = {
        packId,
        type: 'custom',
        title,
        description: String(options.description ?? sourcePack.description ?? '').trim(),
        fandom: sourcePack.fandom || sourceManifest.fandom || '',
        era: sourcePack.era || sourceManifest.era || '',
        author: String(options.author || 'User').trim(),
        version: String(options.version || '1.0.0').trim() || '1.0.0',
        entrySchemaVersion: Number.isFinite(Number(sourceManifest.entrySchemaVersion)) ? Number(sourceManifest.entrySchemaVersion) : (Number(sourcePack.entrySchemaVersion) || 0),
        manifest: baseManifest,
        source: {
            kind: 'derived',
            url: baseManifest,
            updateUrl: '',
        },
        tags: Array.isArray(options.tags) ? options.tags : parseLoredeckTags(options.tags || getDefaultDuplicateLoredeckTags(sourcePack, sourceManifest).join(', ')),
        stats,
        healthStatus: '',
        derivedFrom,
        entryOverrides: {},
        disabledEntryIds: [],
        installedAt: Date.now(),
        updatedAt: Date.now(),
    };
    if (getLoredeckTagRegistryCount(sourcePack.tagRegistry)) {
        record.tagRegistry = normalizeLoredeckTagRegistry(sourcePack.tagRegistry);
    }
    if (getLoredeckTimelineRegistryCount(sourcePack.timelineRegistry)) {
        record.timelineRegistry = normalizeLoredeckTimelineRegistry(sourcePack.timelineRegistry);
    }
    record.manifestData = buildEmbeddedCustomManifest(sourceManifest, record);
    return record;
}

export async function createCustomDuplicateLoredeckRecord(sourcePack, options = {}) {
    const record = await buildCustomDuplicateLoredeckRecord(sourcePack, options);
    const result = upsertLoredeckLibraryPack(record);
    if (!result.ok) throw new Error(result.error || 'Loredeck duplication failed.');
    setLoredeckManifestPreviewCacheRecord(record.packId, {
        manifest: record.manifestData,
        error: '',
        loadedAt: Date.now(),
    });
    return record;
}

export function getFinalizedGeneratedLoredeckTags(pack = {}) {
    const sourceTags = Array.isArray(pack.tags) ? pack.tags : [];
    const tags = sourceTags.filter(tag => {
        const key = String(tag || '').trim().toLowerCase();
        return key
            && key !== 'origin:generated'
            && key !== 'quality:model-drafted'
            && key !== 'saga:creator';
    });
    tags.push('origin:custom', 'source:generated', 'quality:user-managed', 'saga:creator-finalized');
    return parseLoredeckTags(tags.join(', '));
}

export function finalizeGeneratedLoredeckEntry(entry = {}, targetPackId = '', sourcePackId = '', finalizedAt = Date.now()) {
    const next = cloneLoredeckJson(entry) || { ...(entry || {}) };
    next.source = `saga-loredeck:${targetPackId}:custom`;
    const extensions = next.extensions && typeof next.extensions === 'object' && !Array.isArray(next.extensions)
        ? { ...next.extensions }
        : {};
    delete extensions.sagaLoredeckCreator;
    extensions.sagaLoredeckFinalizedFrom = {
        packId: sourcePackId,
        source: 'loredeck_creator',
        finalizedAt,
    };
    if (extensions.sagaLoredeckOverride && typeof extensions.sagaLoredeckOverride === 'object' && !Array.isArray(extensions.sagaLoredeckOverride)) {
        extensions.sagaLoredeckOverride = {
            ...extensions.sagaLoredeckOverride,
            packId: targetPackId,
            source: 'custom_finalized',
        };
    }
    next.extensions = extensions;
    return next;
}

export function buildFinalizedCustomLoredeckRecordFromGenerated(sourcePack = {}, options = {}) {
    if (!isGeneratedLoredeckPack(sourcePack)) throw new Error('Only Generated Loredecks can be finalized as Custom.');
    const packId = normalizeLoredeckPackId(options.packId || getUniqueLoredeckPackId(`${sourcePack.packId}-custom`));
    if (!packId) throw new Error('Finalized Custom Loredeck needs a valid pack ID.');
    if (getLoredeckDefinition(packId)) throw new Error(`A Loredeck with id ${packId} already exists.`);
    const finalizedAt = Date.now();
    const entries = getAcceptedGeneratedLoredeckEntries(sourcePack);
    if (!entries.length) throw new Error('Generated Loredeck needs accepted Lorecards before it can be finalized.');
    const entryOverrides = {};
    for (const entry of entries) {
        const id = normalizeLoredeckEntryId(entry.id);
        if (!id) continue;
        entryOverrides[id] = finalizeGeneratedLoredeckEntry(entry, packId, sourcePack.packId, finalizedAt);
    }
    const stats = buildLoredeckStatsFromEntries(Object.values(entryOverrides));
    const title = String(options.title || getLoredeckDuplicateTitle(sourcePack, 'Custom') || packId).trim() || packId;
    const manifestSeed = {
        ...(cloneLoredeckJson(sourcePack.manifestData) || {}),
        id: packId,
        type: 'custom',
        title,
        description: String(options.description ?? sourcePack.description ?? '').trim(),
        fandom: sourcePack.fandom || sourcePack.manifestData?.fandom || '',
        era: sourcePack.era || sourcePack.manifestData?.era || '',
        author: String(options.author || 'User').trim(),
        version: String(options.version || '1.0.0').trim() || '1.0.0',
        entrySchemaVersion: Math.max(3, Number(sourcePack.entrySchemaVersion || sourcePack.manifestData?.entrySchemaVersion) || 0),
        files: [],
        tags: getFinalizedGeneratedLoredeckTags(sourcePack),
        stats,
        update: {
            checkForUpdates: false,
            url: '',
        },
    };
    const record = {
        packId,
        type: 'custom',
        title,
        description: manifestSeed.description,
        fandom: manifestSeed.fandom,
        era: manifestSeed.era,
        author: manifestSeed.author,
        version: manifestSeed.version,
        entrySchemaVersion: manifestSeed.entrySchemaVersion,
        manifest: '',
        source: {
            kind: 'generated_finalized',
            url: '',
            updateUrl: '',
            originalPackId: sourcePack.packId,
        },
        tags: manifestSeed.tags,
        stats,
        healthStatus: options.healthStatus || sourcePack.healthStatus || '',
        derivedFrom: {
            packId: sourcePack.packId,
            title: sourcePack.title || sourcePack.packId,
            type: 'generated',
            version: sourcePack.version || '',
            creatorJobId: options.creatorJob?.jobId || getLoredeckCreatorJobForPack(sourcePack)?.jobId || '',
            finalizedAt,
            ...(options.creatorCoverageProvenance ? { creatorCoverage: options.creatorCoverageProvenance } : {}),
        },
        entryOverrides,
        disabledEntryIds: Array.isArray(sourcePack.disabledEntryIds) ? [...sourcePack.disabledEntryIds] : [],
        tagRegistry: normalizeLoredeckTagRegistry(sourcePack.tagRegistry),
        timelineRegistry: normalizeLoredeckTimelineRegistry(sourcePack.timelineRegistry),
        pendingChanges: [],
        localModified: true,
        installedAt: finalizedAt,
        updatedAt: finalizedAt,
    };
    record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);
    return record;
}

export async function finalizeGeneratedLoredeckAsCustom(pack, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Finalizing...', { fallbackLabel: 'Finalize as Custom' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!isGeneratedLoredeckPack(fresh)) throw new Error('Only Generated Loredecks can be finalized as Custom.');
        const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: true });
        if (!validation.health) throw new Error(validation.error || 'Validation failed before finalizing.');
        const validated = getFreshLoredeckLibraryPack(fresh.packId, fresh);
        const creatorJob = getLoredeckCreatorJobForPack(validated);
        const readiness = getGeneratedLoredeckExportReadiness(validated, validation.health, creatorJob);
        if (!readiness.ready) {
            throw new Error(`Generated Loredeck is not ready to finalize: ${readiness.blockers[0] || 'resolve pending generated draft state first.'}`);
        }
        if (readiness.warnings.length) {
            const proceed = await confirmAction(
                'Finalize Generated Loredeck with warnings?',
                [
                    `${validated.title || validated.packId} has readiness warnings:`,
                    ...readiness.warnings.slice(0, 6).map(item => `- ${item}`),
                    readiness.warnings.length > 6 ? `- ...and ${readiness.warnings.length - 6} more` : '',
                    '',
                    'Finalize anyway as a Custom Loredeck copy?',
                ].filter(Boolean).join('\n')
            );
            if (!proceed) return null;
        }
        const record = buildFinalizedCustomLoredeckRecordFromGenerated(validated, {
            healthStatus: validation.health.status,
            creatorJob,
            creatorCoverageProvenance: buildLoredeckCreatorCoverageFinalizationProvenance(readiness.pipeline?.coverage),
        });
        createStateBackup('before_creator_finalization', {
            label: `Before finalizing ${validated.title || validated.packId} as Custom.`,
        });
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Generated Loredeck finalization failed.');
        setLoredeckManifestPreviewCacheRecord(record.packId, {
            manifest: record.manifestData,
            health: null,
            error: '',
            loadedAt: Date.now(),
        });
        selectLoredeckForDetails(record.packId, { refresh: false });
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        await validateLoredeckForEditor(record, null, { quiet: true, updateLibrary: true });
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        openLoredeckMetadataEditor(record.packId);
        if (isLoredeckLibraryOpen()) renderLoredeckLibraryOverlay();
        toast(`${record.title || record.packId} finalized as a Custom Loredeck.`, 'success');
        return record;
    } catch (e) {
        toast(e?.message || 'Generated Loredeck finalization failed.', 'error');
        return null;
    } finally {
        restoreBusy();
    }
}

export async function duplicateLoredeckAsCustom(sourcePack, fields, button = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Creating...', { fallbackLabel: 'Create Custom Loredeck' });
    try {
        const packId = normalizeLoredeckPackId(fields.idInput.value);
        const title = fields.titleInput.value.trim() || packId;
        const record = await createCustomDuplicateLoredeckRecord(sourcePack, {
            packId,
            title,
            description: fields.descriptionInput.value.trim(),
            author: fields.authorInput.value.trim(),
            version: fields.versionInput.value.trim() || '1.0.0',
            tags: parseLoredeckTags(fields.tagsInput.value),
        });
        fields.overlay?.remove?.();
        selectLoredeckForDetails(record.packId, { refresh: false });
        if (fields.addToStackInput.checked) {
            addLoredeckToStack(record.packId);
        }
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    } catch (e) {
        toast(e?.message || 'Loredeck duplication failed.', 'error');
    } finally {
        restoreBusy();
    }
}
