/**
 * Loredeck state normalization helpers for Saga.
 */

import { DEFAULT_SETTINGS, getDefaultState } from './constants.js';
import { normalizeLoreEntry } from '../lorecards/lore-matrix.js';
import { normalizeLoredeckLibraryIndex, normalizePackLibraryMetadata } from '../loredecks/loredeck-library-index.js';
import { normalizeLoredeckEntryForSchemaV3 } from '../loredecks/schema-v3-health.js';
import {
    assertSagaUserFilesPath,
    SAGA_STORAGE_JSON_EXTENSION,
    SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
} from '../storage/saga-storage-filenames.js';
import {
    DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
    DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
    DEFAULT_HP_LOREDECK_FOLDER_ID,
    DEFAULT_HP_LOREDECK_ID,
    DEFAULT_HP_LOREDECK_STACK,
    HP_LEGACY_LOREDECK_ID,
    getDefaultLoredeckContextType,
    isDefaultHarryPotterLoredeckId,
} from '../loredecks/loredeck-defaults.js';

const LOREDECK_CONTEXT_TYPES = Object.freeze([
    'calendar',
    'anchor',
    'anchor_window',
    'arc',
    'phase',
    'season_episode',
    'stardate',
    'relative',
    'hybrid',
    'custom',
]);
const LOREDECK_CONTEXT_SOURCES = Object.freeze([
    'manual',
    'header',
    'local_alias',
    'model',
    'detector',
    'imported',
    'unknown',
]);
export const DOCUMENTATION_FIXTURE_LOREDECK_PACK_IDS = Object.freeze([
    'saga-doc-health-sample',
]);

export function isDocumentationFixtureLoredeckPack(packId = '', pack = {}) {
    const raw = pack && typeof pack === 'object' && !Array.isArray(pack) ? pack : {};
    const id = String(raw.packId || raw.id || packId || '').trim().toLowerCase();
    const source = raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source) ? raw.source : {};
    const sourceKind = String(raw.sourceKind || source.kind || '').trim().toLowerCase();
    return DOCUMENTATION_FIXTURE_LOREDECK_PACK_IDS.includes(id) || sourceKind === 'documentation_fixture';
}

function shouldKeepDocumentationFixtureLoredeckPack(packId = '', pack = {}) {
    return typeof globalThis !== 'undefined'
        && globalThis.__sagaDocFixtureActive === true
        && isDocumentationFixtureLoredeckPack(packId, pack);
}

function normalizeSagaUserFilesPointer(value = '', allowedExtensions = []) {
    try {
        return assertSagaUserFilesPath(value, { allowedExtensions });
    } catch (_) {
        return '';
    }
}
function getLoredeckStackItemKey(item = {}) {
    const type = item?.type === 'folder' || item?.folderId ? 'folder' : 'deck';
    const id = type === 'folder'
        ? String(item?.folderId || '').trim()
        : String(item?.packId || item?.deckId || '').trim();
    return id ? `${type}:${id}` : '';
}

export function normalizeLoredeckStack(value) {
    const defaultStack = getDefaultState().loredeckStack;
    const input = Array.isArray(value) ? value : defaultStack;
    const output = [];
    const seen = new Set();

    for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const type = item.type === 'folder' || item.folderId ? 'folder' : 'deck';
        const packId = String(item.packId || item.deckId || '').trim();
        const folderId = String(item.folderId || '').trim();
        if (type === 'deck' && isDocumentationFixtureLoredeckPack(packId) && !shouldKeepDocumentationFixtureLoredeckPack(packId)) continue;
        const key = getLoredeckStackItemKey({ type, packId, folderId });
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const priority = Number(item.priority);
        const normalized = {
            type,
            enabled: item.enabled !== false,
            priority: Number.isFinite(priority) ? priority : Math.max(1, 100 - output.length),
            locked: item.locked === true,
            addedAt: Number.isFinite(Number(item.addedAt)) ? Number(item.addedAt) : 0,
        };
        if (type === 'folder') {
            normalized.folderId = folderId;
            normalized.includeNested = item.includeNested !== false;
            normalized.collapsed = item.collapsed === true;
        } else {
            normalized.packId = packId;
        }
        output.push(normalized);
    }

    return output.length || Array.isArray(value) ? output : JSON.parse(JSON.stringify(defaultStack));
}

function cloneDefaultHpLoredeckStack() {
    return DEFAULT_HP_LOREDECK_STACK.map(item => ({ ...item }));
}

function isLegacyHpLoredeckStackItem(item = {}) {
    const type = item?.type === 'folder' || item?.folderId ? 'folder' : 'deck';
    return type === 'deck' && String(item?.packId || item?.deckId || '').trim() === HP_LEGACY_LOREDECK_ID;
}

function replaceLegacyHpLoredeckStack(value) {
    const input = Array.isArray(value) ? value : [];
    let replaced = false;
    let insertedDefault = false;
    const output = [];
    for (const item of input) {
        if (isLegacyHpLoredeckStackItem(item)) {
            replaced = true;
            if (!insertedDefault) {
                output.push(...cloneDefaultHpLoredeckStack());
                insertedDefault = true;
            }
            continue;
        }
        output.push(item);
    }
    return replaced ? output : value;
}

function isDefaultHpLoredeckFolderStack(value) {
    if (!Array.isArray(value) || value.length !== 1) return false;
    const item = value[0] || {};
    const type = item.type === 'folder' || item.folderId ? 'folder' : 'deck';
    return type === 'folder'
        && String(item.folderId || '').trim() === DEFAULT_HP_LOREDECK_FOLDER_ID
        && item.enabled !== false
        && item.includeNested !== false
        && !String(item.packId || item.deckId || '').trim();
}

export function clearDefaultHpLoredeckFolderStack(value) {
    return isDefaultHpLoredeckFolderStack(value) ? [] : value;
}

export function migrateLegacyHpLoredeckRegistry(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const packs = { ...(input.packs || {}) };
    delete packs[HP_LEGACY_LOREDECK_ID];
    for (const [packId, pack] of Object.entries(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS)) {
        if (!packs[packId]) packs[packId] = pack;
    }
    return {
        ...input,
        schemaVersion: 1,
        packs,
        deckPlacements: Array.isArray(input.deckPlacements)
            ? input.deckPlacements.filter(item => String(item?.deckId || item?.packId || '').trim() !== HP_LEGACY_LOREDECK_ID)
            : input.deckPlacements,
        activeStack: replaceLegacyHpLoredeckStack(input.activeStack),
    };
}

function migrateLegacyHpLoredeckContexts(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
    delete input[HP_LEGACY_LOREDECK_ID];
    for (const [packId, context] of Object.entries(DEFAULT_BUNDLED_LOREDECK_CONTEXTS)) {
        if (!input[packId]) input[packId] = { ...context };
    }
    return input;
}

export function migrateLegacyHpLoredeckState(state = {}) {
    const hasLegacyStack = Array.isArray(state.loredeckStack) && state.loredeckStack.some(isLegacyHpLoredeckStackItem);
    const hasLegacyRegistry = !!state.loredeckRegistry?.packs?.[HP_LEGACY_LOREDECK_ID];
    const hasLegacyContext = !!state.loredeckContexts?.[HP_LEGACY_LOREDECK_ID];
    const hasLegacySelection = state.lorePanel?.selectedLoredeckId === HP_LEGACY_LOREDECK_ID;
    if (!hasLegacyStack && !hasLegacyRegistry && !hasLegacyContext && !hasLegacySelection) return state;
    state.loredeckStack = replaceLegacyHpLoredeckStack(state.loredeckStack);
    state.loredeckRegistry = migrateLegacyHpLoredeckRegistry(state.loredeckRegistry);
    state.loredeckContexts = migrateLegacyHpLoredeckContexts(state.loredeckContexts);
    if (hasLegacySelection) {
        state.lorePanel.selectedLoredeckId = DEFAULT_HP_LOREDECK_ID;
    }
    return state;
}

export function clearDefaultHpLoredeckStackOnce(state = {}) {
    if (state.hpDefaultLoredeckStackCleared20260605 === true) return state;
    state.loredeckStack = clearDefaultHpLoredeckFolderStack(state.loredeckStack);
    state.hpDefaultLoredeckStackCleared20260605 = true;
    return state;
}

function normalizeContextType(value, fallback = 'custom') {
    const normalized = String(value || '').trim().toLowerCase();
    return LOREDECK_CONTEXT_TYPES.includes(normalized) ? normalized : fallback;
}

function normalizeContextSource(value, fallback = 'unknown') {
    const normalized = String(value || '').trim().toLowerCase();
    return LOREDECK_CONTEXT_SOURCES.includes(normalized) ? normalized : fallback;
}

function clampContextConfidence(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (number > 1 && number <= 100) return Math.max(0, Math.min(1, number / 100));
    return Math.max(0, Math.min(1, number));
}

export function cleanContextString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanContextField(input, key, maxLength, fallback = '') {
    return Object.prototype.hasOwnProperty.call(input || {}, key)
        ? cleanContextString(input[key], maxLength)
        : fallback;
}

function cleanContextNumber(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function cleanContextStringArray(value, limit = 24, maxLength = 160) {
    const source = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
    const output = [];
    const seen = new Set();
    for (const raw of source) {
        const text = cleanContextString(raw, maxLength);
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

function normalizeContextCoordinates(value = {}) {
    const output = {};
    const assign = (axis, rawValue) => {
        const cleanAxis = cleanContextString(axis, 80);
        const cleanValue = cleanContextString(rawValue, 180);
        if (!cleanAxis || !cleanValue || Object.keys(output).length >= 24) return;
        output[cleanAxis] = cleanValue;
    };

    if (Array.isArray(value)) {
        for (const item of value) {
            if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
            assign(item.axis || item.type, item.id || item.value || item.label);
        }
        return output;
    }

    if (value && typeof value === 'object') {
        for (const [axis, rawValue] of Object.entries(value)) {
            if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
                assign(axis, rawValue.id || rawValue.value || rawValue.label);
            } else {
                assign(axis, rawValue);
            }
        }
    }
    return output;
}

function normalizeContextBriefEvidence(value = []) {
    return (Array.isArray(value) ? value : [])
        .map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const quote = cleanContextString(item.quote || item.text || item.snippet, 280);
            const signal = cleanContextString(item.signal || item.type || item.kind, 80);
            return quote || signal ? { quote, signal } : null;
        })
        .filter(Boolean)
        .slice(0, 12);
}

function normalizeContextBriefStatus(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const state = cleanContextString(input.state || input.status, 40).toLowerCase();
    const allowedStates = ['idle', 'detected', 'repaired', 'fallback', 'failed', 'empty', 'skipped'];
    return {
        state: allowedStates.includes(state) ? state : 'idle',
        message: cleanContextString(input.message || input.reason, 240),
        error: cleanContextString(input.error || input.lastError, 500),
        repaired: input.repaired === true,
        fallbackUsed: input.fallbackUsed === true,
        rawResponsePreview: cleanContextString(input.rawResponsePreview || input.preview, 1000),
    };
}

export function normalizeContextBrief(value = {}, legacyContext = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const legacy = legacyContext && typeof legacyContext === 'object' && !Array.isArray(legacyContext) ? legacyContext : {};
    const rawSignals = input.signals && typeof input.signals === 'object' && !Array.isArray(input.signals) ? input.signals : {};
    const rawUncertainty = input.uncertainty && typeof input.uncertainty === 'object' && !Array.isArray(input.uncertainty) ? input.uncertainty : {};
    const uncertaintyLevel = cleanContextString(rawUncertainty.level, 40).toLowerCase();
    return {
        schemaVersion: 1,
        summary: cleanContextString(input.summary || legacy.summary, 500),
        branchId: cleanContextString(input.branchId || legacy.branchId || 'main', 120) || 'main',
        timeTravelMode: cleanContextString(input.timeTravelMode || legacy.timeTravelMode || 'none', 80) || 'none',
        evidence: normalizeContextBriefEvidence(input.evidence),
        signals: {
            sceneDate: cleanContextString(rawSignals.sceneDate || input.sceneDate || legacy.sceneDate, 80),
            subjectiveDate: cleanContextString(rawSignals.subjectiveDate || input.subjectiveDate || legacy.subjectiveDate, 80),
            canonBoundary: cleanContextString(rawSignals.canonBoundary || input.canonBoundary || legacy.canonBoundary, 240),
            positionPhrases: cleanContextStringArray(rawSignals.positionPhrases || input.positionPhrases, 16, 180),
            fandomHints: cleanContextStringArray(rawSignals.fandomHints || input.fandomHints, 16, 140),
            arc: cleanContextString(rawSignals.arc || input.arc, 180),
            phase: cleanContextString(rawSignals.phase || input.phase, 180),
            season: cleanContextString(rawSignals.season || input.season, 80),
            episode: cleanContextString(rawSignals.episode || input.episode, 80),
            chapter: cleanContextString(rawSignals.chapter || input.chapter, 80),
            issue: cleanContextString(rawSignals.issue || input.issue, 80),
            quest: cleanContextString(rawSignals.quest || input.quest, 180),
            gameStage: cleanContextString(rawSignals.gameStage || input.gameStage, 180),
            stardate: cleanContextString(rawSignals.stardate || input.stardate, 80),
            coordinates: normalizeContextCoordinates(rawSignals.coordinates || input.coordinates),
            eventLabels: cleanContextStringArray(rawSignals.eventLabels || input.eventLabels, 24, 180),
        },
        uncertainty: {
            level: ['low', 'medium', 'high'].includes(uncertaintyLevel) ? uncertaintyLevel : 'low',
            notes: cleanContextStringArray(rawUncertainty.notes || input.uncertaintyNotes, 12, 240),
        },
        status: normalizeContextBriefStatus(input.status),
        source: normalizeContextSource(input.source, 'unknown'),
        updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : 0,
    };
}

function buildDefaultLoredeckContext(packId = '', legacyContext = {}) {
    const id = cleanContextString(packId, 120);
    const sceneDate = cleanContextString(legacyContext?.sceneDate, 80);
    const canonBoundary = cleanContextString(legacyContext?.canonBoundary, 240);
    return {
        schemaVersion: 1,
        packId: id,
        contextType: getDefaultLoredeckContextType(id, id === HP_LEGACY_LOREDECK_ID || isDefaultHarryPotterLoredeckId(id) ? 'calendar' : 'custom'),
        label: canonBoundary || sceneDate || '',
        sceneDate,
        subjectiveDate: cleanContextString(legacyContext?.subjectiveDate, 80),
        stardate: cleanContextString(legacyContext?.stardate, 80),
        contextSortKey: null,
        contextSortKeyFrom: null,
        contextSortKeyTo: null,
        anchorId: '',
        anchorFrom: '',
        anchorTo: '',
        arc: '',
        phase: '',
        season: '',
        episode: '',
        chapter: '',
        issue: '',
        quest: '',
        gameStage: '',
        coordinates: normalizeContextCoordinates(legacyContext?.coordinates),
        alias: canonBoundary || '',
        notes: '',
        branchId: cleanContextString(legacyContext?.branchId || 'main', 120) || 'main',
        confidence: sceneDate || canonBoundary ? 0.5 : 0,
        manualLock: false,
        source: sceneDate || canonBoundary ? 'unknown' : 'unknown',
        updatedAt: Number.isFinite(Number(legacyContext?.lastDetectedAt)) ? Number(legacyContext.lastDetectedAt) : 0,
    };
}

export function normalizeLoredeckContext(value, packId = '', legacyContext = {}) {
    const id = cleanContextString(value?.packId || packId, 120);
    const defaults = buildDefaultLoredeckContext(id, legacyContext);
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {
        ...defaults,
        schemaVersion: 1,
        packId: id || defaults.packId,
        contextType: normalizeContextType(input.contextType, defaults.contextType),
        label: cleanContextField(input, 'label', 240, defaults.label),
        sceneDate: cleanContextField(input, 'sceneDate', 80, defaults.sceneDate),
        subjectiveDate: cleanContextField(input, 'subjectiveDate', 80, defaults.subjectiveDate),
        stardate: cleanContextField(input, 'stardate', 80, defaults.stardate),
        contextSortKey: cleanContextNumber(input.contextSortKey ?? input.sortKey, defaults.contextSortKey),
        contextSortKeyFrom: cleanContextNumber(input.contextSortKeyFrom ?? input.sortKeyFrom, defaults.contextSortKeyFrom),
        contextSortKeyTo: cleanContextNumber(input.contextSortKeyTo ?? input.sortKeyTo, defaults.contextSortKeyTo),
        anchorId: cleanContextField(input, 'anchorId', 180, ''),
        anchorFrom: cleanContextField(input, 'anchorFrom', 180, ''),
        anchorTo: cleanContextField(input, 'anchorTo', 180, ''),
        arc: cleanContextField(input, 'arc', 180, ''),
        phase: cleanContextField(input, 'phase', 180, ''),
        season: cleanContextField(input, 'season', 80, ''),
        episode: cleanContextField(input, 'episode', 80, ''),
        chapter: cleanContextField(input, 'chapter', 80, ''),
        issue: cleanContextField(input, 'issue', 80, ''),
        quest: cleanContextField(input, 'quest', 180, ''),
        gameStage: cleanContextField(input, 'gameStage', 180, ''),
        coordinates: normalizeContextCoordinates(input.coordinates || defaults.coordinates),
        alias: cleanContextField(input, 'alias', 240, defaults.alias),
        notes: cleanContextField(input, 'notes', 1000, ''),
        branchId: cleanContextString(input.branchId || defaults.branchId || 'main', 120) || 'main',
        confidence: clampContextConfidence(input.confidence, defaults.confidence),
        manualLock: input.manualLock === true,
        source: normalizeContextSource(input.source, defaults.source),
        updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : defaults.updatedAt,
    };
    if (!output.label) {
        output.label = [
            output.arc,
            output.phase,
            output.anchorId,
            output.sceneDate,
            output.alias,
        ].filter(Boolean)[0] || '';
    }
    return output;
}

export function normalizeLoredeckContexts(value, state = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {};
    for (const [rawPackId, rawContext] of Object.entries(input)) {
        const packId = cleanContextString(rawContext?.packId || rawPackId, 120);
        if (!packId) continue;
        output[packId] = normalizeLoredeckContext(rawContext, packId, state?.loreContext || {});
    }

    const stack = normalizeLoredeckStack(state?.loredeckStack || []);
    for (const item of stack) {
        if (!item.packId || output[item.packId]) continue;
        output[item.packId] = normalizeLoredeckContext(null, item.packId, state?.loreContext || {});
    }

    return output;
}

export function cloneLoredeckPlainObject(value, maxLength = 200000) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    try {
        const text = JSON.stringify(value);
        if (!text || text.length > maxLength) return null;
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

function normalizeEmbeddedLoredeckManifest(value) {
    const manifest = cloneLoredeckPlainObject(value);
    if (!manifest) return null;
    delete manifest.entries;
    if (!Array.isArray(manifest.files)) manifest.files = [];
    manifest.files = manifest.files.map(file => String(file || '').trim()).filter(Boolean).slice(0, 1000);
    if (Array.isArray(manifest.tags)) {
        manifest.tags = manifest.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 64);
    }
    return manifest;
}

function isImportedZipLoredeckRecord(raw = {}, source = {}, derivedFrom = null) {
    return String(source?.kind || raw?.source?.kind || '').trim() === 'imported_zip'
        || String(source?.bundleType || raw?.source?.bundleType || '').trim() === 'saga_loredeck_zip_package'
        || String(derivedFrom?.kind || raw?.derivedFrom?.kind || '').trim() === 'imported_loredeck_package';
}

function normalizeLoredeckOverrideTags(value = [], limit = 64) {
    const input = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const output = [];
    const seen = new Set();
    for (const raw of input) {
        const tag = String(raw || '')
            .trim()
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .slice(0, 120)
            .trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(tag);
        if (output.length >= limit) break;
    }
    return output;
}

function normalizeSchemaV3LoredeckEntryOverride(raw = {}, id = '') {
    const title = String(raw.title || raw.name || id || 'Lorecard').trim() || 'Lorecard';
    const category = String(raw.category || 'other').trim() || 'other';
    const priority = Number(raw.priority);
    const next = normalizeLoredeckEntryForSchemaV3({
        ...raw,
        id,
        title,
        schemaVersion: 3,
        category,
        canon: String(raw.canon || raw.canonStatus || 'au').trim() || 'au',
        canonStatus: String(raw.canonStatus || raw.canon || 'au').trim() || 'au',
        relevance: String(raw.relevance || 'normal').trim() || 'normal',
        priority: Number.isFinite(priority) ? priority : 50,
        tags: normalizeLoredeckOverrideTags(raw.tags),
        userEditable: raw.userEditable !== false,
        userEdited: true,
    });
    next.id = id;
    next.title = title;
    next.tags = normalizeLoredeckOverrideTags(next.tags);
    return next;
}

export function normalizeLoredeckEntryOverrides(value, options = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    const expectedSchemaVersion = Number(options.entrySchemaVersion) || 0;
    let count = 0;
    for (const [key, raw] of Object.entries(value)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        const schemaVersion = Math.max(Number(raw.schemaVersion) || 0, expectedSchemaVersion);
        const entry = schemaVersion >= 3
            ? normalizeSchemaV3LoredeckEntryOverride(raw, id)
            : normalizeLoreEntry({
                ...raw,
                id,
                userEditable: raw.userEditable !== false,
                userEdited: true,
            });
        entry.id = id;
        output[id] = entry;
        count += 1;
        if (count >= 5000) break;
    }
    return output;
}

export function normalizeLoredeckDisabledEntryIds(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const output = [];
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        output.push(id);
        if (output.length >= 1000) break;
    }
    return output;
}

export function normalizeLoredeckHealthIssueStates(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    let count = 0;
    for (const [rawKey, rawState] of Object.entries(value)) {
        if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) continue;
        const key = String(rawKey || rawState.issueKey || '').trim().replace(/[^a-z0-9_.:-]+/gi, '_').slice(0, 160);
        const status = String(rawState.status || '').trim().toLowerCase();
        if (!key || !['ignored', 'resolved'].includes(status)) continue;
        output[key] = {
            status,
            issueKey: key,
            code: String(rawState.code || '').trim().slice(0, 120),
            severity: String(rawState.severity || '').trim().slice(0, 40),
            title: String(rawState.title || '').trim().slice(0, 240),
            note: String(rawState.note || '').trim().slice(0, 500),
            updatedAt: Number.isFinite(Number(rawState.updatedAt)) ? Number(rawState.updatedAt) : Date.now(),
        };
        count += 1;
        if (count >= 500) break;
    }
    return output;
}

export function normalizeLoredeckPendingChanges(value) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const changeId = String(raw.changeId || raw.id || '').trim() || `pending_${output.length + 1}`;
        if (seen.has(changeId)) continue;
        seen.add(changeId);
        const payload = cloneLoredeckPlainObject(raw.payload, 200000) || {};
        const preview = cloneLoredeckPlainObject(raw.preview, 20000) || {};
        output.push({
            schemaVersion: Number.isFinite(Number(raw.schemaVersion)) ? Number(raw.schemaVersion) : 1,
            changeId,
            status: 'pending',
            source: String(raw.source || 'manual').trim().slice(0, 80),
            action: String(raw.action || 'record_patch').trim().slice(0, 80),
            targetKind: String(raw.targetKind || 'loredeck').trim().slice(0, 80),
            title: String(raw.title || changeId).trim().slice(0, 240),
            description: String(raw.description || '').trim().slice(0, 1000),
            affectedEntryIds: normalizeLoredeckDisabledEntryIds(raw.affectedEntryIds).slice(0, 500),
            affectedTagIds: Array.isArray(raw.affectedTagIds)
                ? raw.affectedTagIds.map(tag => cleanLoredeckTagRegistryId(tag)).filter(Boolean).slice(0, 500)
                : [],
            affectedTimelineIds: Array.isArray(raw.affectedTimelineIds)
                ? raw.affectedTimelineIds.map(id => cleanLoredeckTimelineRegistryId(id)).filter(Boolean).slice(0, 500)
                : [],
            payload,
            preview,
            createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now(),
        });
        if (output.length >= 500) break;
    }
    return output;
}

function cleanLoredeckTagRegistryId(value) {
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

function normalizeLoredeckTagRegistryList(value, limit = 64, normalizeId = false) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const text = normalizeId ? cleanLoredeckTagRegistryId(raw) : String(raw || '').trim().slice(0, 120).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

export function normalizeLoredeckTagRegistry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const rawTags = value.tags && typeof value.tags === 'object' && !Array.isArray(value.tags)
        ? value.tags
        : value;
    if (!rawTags || typeof rawTags !== 'object' || Array.isArray(rawTags)) return null;
    const tags = {};
    let count = 0;
    for (const [rawId, rawDef] of Object.entries(rawTags)) {
        if (!rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef)) continue;
        const id = cleanLoredeckTagRegistryId(rawDef.id || rawId);
        if (!id) continue;
        tags[id] = {
            label: String(rawDef.label || '').trim().slice(0, 160),
            color: String(rawDef.color || '').trim().slice(0, 32),
            textColor: String(rawDef.textColor || '').trim().slice(0, 32),
            description: String(rawDef.description || rawDef.notes || '').trim().slice(0, 1000),
            aliases: normalizeLoredeckTagRegistryList(rawDef.aliases, 64, false),
            parents: normalizeLoredeckTagRegistryList(rawDef.parents, 64, true),
            sensitive: rawDef.sensitive === true,
            deprecated: rawDef.deprecated === true,
            replacement: cleanLoredeckTagRegistryId(rawDef.replacement || ''),
        };
        count += 1;
        if (count >= 2000) break;
    }
    if (!Object.keys(tags).length) return null;
    return {
        schemaVersion: 1,
        tags,
    };
}

function cleanLoredeckTimelineRegistryId(value) {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '_')
        .slice(0, 180)
        .trim();
}

function normalizeLoredeckTimelineRegistryList(value, limit = 64) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const text = String(raw || '').trim().slice(0, 160).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

function normalizeLoredeckTimelineDateRange(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        from: String(input.from || input.start || input.validFrom || '').trim().slice(0, 80),
        to: String(input.to || input.end || input.validTo || '').trim().slice(0, 80),
        precision: String(input.precision || '').trim().slice(0, 40),
    };
}

function normalizeLoredeckTimelineNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function normalizeLoredeckTimelineAnchor(raw = {}, fallbackId = '', index = 0) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = cleanLoredeckTimelineRegistryId(raw.id || fallbackId);
    if (!id) return null;
    const anchor = {
        id,
        label: String(raw.label || raw.title || id).trim().slice(0, 240),
        contextType: String(raw.contextType || raw.type || 'anchor').trim().slice(0, 80),
        sortKey: normalizeLoredeckTimelineNumber(raw.sortKey) ?? index + 1,
        dateRange: normalizeLoredeckTimelineDateRange(raw.dateRange || raw.date || raw.canonTiming),
        book: String(raw.book || raw.sourceInfo?.title || raw.source?.book || '').trim().slice(0, 160),
        work: String(raw.work || raw.sourceInfo?.work || raw.source?.work || '').trim().slice(0, 160),
        schoolYear: String(raw.schoolYear || raw.date?.schoolYear || raw.canonTiming?.schoolYear || '').trim().slice(0, 80),
        arc: String(raw.arc || '').trim().slice(0, 180),
        phase: String(raw.phase || '').trim().slice(0, 180),
        season: String(raw.season || '').trim().slice(0, 80),
        episode: String(raw.episode || '').trim().slice(0, 80),
        chapter: String(raw.chapter || '').trim().slice(0, 80),
        issue: String(raw.issue || '').trim().slice(0, 80),
        quest: String(raw.quest || '').trim().slice(0, 180),
        gameStage: String(raw.gameStage || '').trim().slice(0, 180),
        stardate: String(raw.stardate || '').trim().slice(0, 80),
        stardateFrom: String(raw.stardateFrom || raw.stardateStart || '').trim().slice(0, 80),
        stardateTo: String(raw.stardateTo || raw.stardateEnd || '').trim().slice(0, 80),
        aliases: normalizeLoredeckTimelineRegistryList(raw.aliases || raw.triggers, 64),
        tags: normalizeLoredeckTimelineRegistryList(raw.tags, 64),
        notes: String(raw.notes || raw.description || '').trim().slice(0, 1000),
    };
    if (raw.sourceInfo && typeof raw.sourceInfo === 'object' && !Array.isArray(raw.sourceInfo)) {
        anchor.sourceInfo = cloneLoredeckPlainObject(raw.sourceInfo, 10000);
    }
    return anchor;
}

function normalizeLoredeckTimelineWindow(raw = {}, fallbackId = '', index = 0) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = cleanLoredeckTimelineRegistryId(raw.id || fallbackId);
    if (!id) return null;
    return {
        id,
        label: String(raw.label || raw.title || id).trim().slice(0, 240),
        contextType: String(raw.contextType || raw.type || 'anchor_window').trim().slice(0, 80),
        anchorFrom: cleanLoredeckTimelineRegistryId(raw.anchorFrom || raw.from || raw.validFromAnchor),
        anchorTo: cleanLoredeckTimelineRegistryId(raw.anchorTo || raw.to || raw.validToAnchor),
        sortKeyFrom: normalizeLoredeckTimelineNumber(raw.sortKeyFrom ?? raw.fromSortKey ?? raw.sortKeyStart),
        sortKeyTo: normalizeLoredeckTimelineNumber(raw.sortKeyTo ?? raw.toSortKey ?? raw.sortKeyEnd),
        dateRange: normalizeLoredeckTimelineDateRange(raw.dateRange || raw.date),
        schoolYear: String(raw.schoolYear || raw.date?.schoolYear || raw.canonTiming?.schoolYear || '').trim().slice(0, 80),
        arc: String(raw.arc || '').trim().slice(0, 180),
        phase: String(raw.phase || '').trim().slice(0, 180),
        season: String(raw.season || '').trim().slice(0, 80),
        episode: String(raw.episode || '').trim().slice(0, 80),
        chapter: String(raw.chapter || '').trim().slice(0, 80),
        issue: String(raw.issue || '').trim().slice(0, 80),
        quest: String(raw.quest || '').trim().slice(0, 180),
        gameStage: String(raw.gameStage || '').trim().slice(0, 180),
        stardateFrom: String(raw.stardateFrom || raw.stardateStart || '').trim().slice(0, 80),
        stardateTo: String(raw.stardateTo || raw.stardateEnd || '').trim().slice(0, 80),
        coordinates: normalizeContextCoordinates(raw.coordinates),
        aliases: normalizeLoredeckTimelineRegistryList(raw.aliases || raw.triggers, 64),
        tags: normalizeLoredeckTimelineRegistryList(raw.tags, 64),
        notes: String(raw.notes || raw.description || '').trim().slice(0, 1000),
    };
}

function normalizeLoredeckTimelineDisabledIds(value = []) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const id = cleanLoredeckTimelineRegistryId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        output.push(id);
        if (output.length >= 2000) break;
    }
    return output;
}

function hasOwnTimelineRegistryField(value = {}, field = '') {
    return Object.prototype.hasOwnProperty.call(value, field);
}

export function normalizeLoredeckTimelineRegistryIssueRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const reason = String(value.reason || value.message || '').trim().slice(0, 500);
    const code = String(value.code || 'malformed_timeline_registry').trim().slice(0, 120) || 'malformed_timeline_registry';
    if (!reason && code !== 'malformed_timeline_registry') return null;
    return {
        code,
        severity: 'warning',
        reason: reason || 'Timeline registry overlay is malformed.',
    };
}

export function normalizeLoredeckTimelineRegistryIssue(value, normalized = normalizeLoredeckTimelineRegistry(value)) {
    if (normalized) return null;
    if (value === undefined) return null;
    let reason = '';
    if (value === null) {
        reason = 'Timeline registry is null.';
    } else if (typeof value !== 'object' || Array.isArray(value)) {
        reason = 'Timeline registry must be an object.';
    } else {
        const invalidArrayFields = [
            'anchors',
            'windows',
            'arcs',
            'phases',
            'disabledAnchorIds',
            'disabledAnchors',
            'disabledWindowIds',
            'disabledWindows',
        ].filter(field => hasOwnTimelineRegistryField(value, field) && !Array.isArray(value[field]));
        reason = invalidArrayFields.length
            ? `Timeline registry field${invalidArrayFields.length === 1 ? '' : 's'} must be array-based: ${invalidArrayFields.join(', ')}.`
            : 'Timeline registry has no usable anchors, windows, or disabled timeline ids.';
    }
    return {
        code: 'malformed_timeline_registry',
        severity: 'warning',
        reason,
    };
}

export function normalizeLoredeckTimelineRegistry(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const input = value;
    const anchors = [];
    for (const [index, raw] of (Array.isArray(input.anchors) ? input.anchors : []).entries()) {
        const anchor = normalizeLoredeckTimelineAnchor(raw, '', index);
        if (anchor) anchors.push(anchor);
        if (anchors.length >= 5000) break;
    }
    const windows = [];
    const rawWindows = [
        ...(Array.isArray(input.windows) ? input.windows : []),
        ...(Array.isArray(input.arcs) ? input.arcs : []),
        ...(Array.isArray(input.phases) ? input.phases : []),
    ];
    for (const [index, raw] of rawWindows.entries()) {
        const window = normalizeLoredeckTimelineWindow(raw, '', index);
        if (window) windows.push(window);
        if (windows.length >= 5000) break;
    }
    const disabledAnchorIds = normalizeLoredeckTimelineDisabledIds(input.disabledAnchorIds || input.disabledAnchors || []);
    const disabledWindowIds = normalizeLoredeckTimelineDisabledIds(input.disabledWindowIds || input.disabledWindows || []);
    if (!anchors.length && !windows.length && !disabledAnchorIds.length && !disabledWindowIds.length) return null;
    return {
        schemaVersion: Number.isFinite(Number(input.schemaVersion)) ? Number(input.schemaVersion) : 1,
        timelineMode: String(input.timelineMode || 'hybrid').trim().slice(0, 80),
        defaultContextType: String(input.defaultContextType || '').trim().slice(0, 80),
        sortKeyScale: String(input.sortKeyScale || 'pack_local').trim().slice(0, 160),
        summary: String(input.summary || input.description || '').trim().slice(0, 1000),
        anchors,
        windows,
        ...(disabledAnchorIds.length ? { disabledAnchorIds } : {}),
        ...(disabledWindowIds.length ? { disabledWindowIds } : {}),
    };
}

export function normalizeLoredeckRegistry(value, defaults = getDefaultState().loredeckRegistry) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const inputPacks = input.packs && typeof input.packs === 'object' && !Array.isArray(input.packs) ? input.packs : {};
    const defaultPacks = defaults.packs || {};
    const packs = {};
    const removedDocumentationFixturePackIds = new Set();

    const mergedPacks = { ...defaultPacks, ...inputPacks };
    for (const [packId, mergedRaw] of Object.entries(mergedPacks)) {
        if (isDocumentationFixtureLoredeckPack(packId, mergedRaw) && !shouldKeepDocumentationFixtureLoredeckPack(packId, mergedRaw)) {
            const fixtureId = String(mergedRaw?.packId || mergedRaw?.id || packId || '').trim();
            if (fixtureId) removedDocumentationFixturePackIds.add(fixtureId);
            continue;
        }
        const bundledDefault = defaultPacks[packId]?.type === 'bundled' ? defaultPacks[packId] : null;
        const raw = bundledDefault || mergedRaw;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.packId || packId || '').trim();
        if (!id) continue;
        const type = ['bundled', 'custom', 'generated'].includes(raw.type) ? raw.type : 'custom';
        const source = raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source) ? raw.source : {};
        const stats = raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : {};
        const derivedFrom = cloneLoredeckPlainObject(raw.derivedFrom, 20000);
        const importedZip = isImportedZipLoredeckRecord(raw, source, derivedFrom);
        const pack = {
            packId: id,
            type,
            title: String(raw.title || id).trim(),
            description: String(raw.description || '').trim(),
            fandom: String(raw.fandom || '').trim(),
            era: String(raw.era || '').trim(),
            author: String(raw.author || '').trim(),
            version: String(raw.version || '').trim(),
            entrySchemaVersion: Number.isFinite(Number(raw.entrySchemaVersion)) ? Number(raw.entrySchemaVersion) : 0,
            manifest: String(raw.manifest || '').trim(),
            source: {
                kind: String(source.kind || (type === 'bundled' ? 'bundled' : 'local')).trim(),
                url: String(source.url || '').trim(),
                updateUrl: String(source.updateUrl || '').trim(),
                installedFrom: String(source.installedFrom || '').trim(),
                bundleType: String(source.bundleType || '').trim(),
                originalPackId: String(source.originalPackId || '').trim(),
                contentHash: String(source.contentHash || '').trim(),
                exportedAt: Number.isFinite(Number(source.exportedAt)) ? Number(source.exportedAt) : 0,
                importedAt: Number.isFinite(Number(source.importedAt)) ? Number(source.importedAt) : 0,
            },
            tags: Array.isArray(raw.tags) ? raw.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 64) : [],
            stats: {
                entryCount: Number.isFinite(Number(stats.entryCount)) ? Math.max(0, Number(stats.entryCount)) : 0,
                categoryCounts: stats.categoryCounts && typeof stats.categoryCounts === 'object' && !Array.isArray(stats.categoryCounts)
                    ? { ...stats.categoryCounts }
                    : {},
            },
            healthStatus: String(raw.healthStatus || '').trim(),
            localModified: raw.localModified === true,
            installedAt: Number.isFinite(Number(raw.installedAt)) ? Number(raw.installedAt) : 0,
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
        };
        const payloadFile = normalizeSagaUserFilesPointer(raw.payloadFile || raw.payloadPath || '', [SAGA_STORAGE_JSON_EXTENSION]);
        if (payloadFile) pack.payloadFile = payloadFile;
        const coverFile = normalizeSagaUserFilesPointer(raw.coverFile || raw.coverPath || raw.coverImage || '', SAGA_STORAGE_RASTER_ASSET_EXTENSIONS);
        if (coverFile) pack.coverFile = coverFile;
        const assets = cloneLoredeckPlainObject(raw.assets, 1500000);
        if (assets) pack.assets = assets;
        else if (raw.cover || raw.coverImage) {
            pack.assets = {
                cover: raw.cover || raw.coverImage,
            };
        }
        if (derivedFrom) pack.derivedFrom = derivedFrom;
        const manifestData = normalizeEmbeddedLoredeckManifest(raw.manifestData);
        if (importedZip && manifestData?.library) delete manifestData.library;
        if (manifestData) pack.manifestData = manifestData;
        const library = importedZip ? {} : normalizePackLibraryMetadata(raw.library || manifestData?.library || {});
        if (Object.keys(library).length) pack.library = library;
        pack.entryOverrides = normalizeLoredeckEntryOverrides(raw.entryOverrides, {
            entrySchemaVersion: pack.entrySchemaVersion || manifestData?.entrySchemaVersion || 0,
        });
        pack.disabledEntryIds = normalizeLoredeckDisabledEntryIds(raw.disabledEntryIds);
        const tagRegistry = normalizeLoredeckTagRegistry(raw.tagRegistry);
        if (tagRegistry) pack.tagRegistry = tagRegistry;
        const timelineRegistry = normalizeLoredeckTimelineRegistry(raw.timelineRegistry);
        if (timelineRegistry) pack.timelineRegistry = timelineRegistry;
        else {
            const existingIssue = normalizeLoredeckTimelineRegistryIssueRecord(raw.timelineRegistryIssue);
            const issue = existingIssue || (Object.prototype.hasOwnProperty.call(raw, 'timelineRegistry')
                ? normalizeLoredeckTimelineRegistryIssue(raw.timelineRegistry, timelineRegistry)
                : null);
            if (issue) pack.timelineRegistryIssue = issue;
        }
        const pendingChanges = normalizeLoredeckPendingChanges(raw.pendingChanges);
        if (pendingChanges.length) pack.pendingChanges = pendingChanges;
        const healthIssueStates = normalizeLoredeckHealthIssueStates(raw.healthIssueStates);
        if (Object.keys(healthIssueStates).length) pack.healthIssueStates = healthIssueStates;
        packs[id] = pack;
    }
    const libraryIndex = normalizeLoredeckLibraryIndex(input, { defaults, packs });
    const shouldRemoveFixtureLayoutPackId = packId => (
        removedDocumentationFixturePackIds.has(String(packId || '').trim())
        || (isDocumentationFixtureLoredeckPack(packId) && !shouldKeepDocumentationFixtureLoredeckPack(packId))
    );

    return {
        schemaVersion: 1,
        packs,
        folders: libraryIndex.folders,
        deckPlacements: libraryIndex.deckPlacements.filter(placement => !shouldRemoveFixtureLayoutPackId(placement.deckId || placement.packId)),
        activeStack: libraryIndex.activeStack.filter(item => item.type === 'folder' || !shouldRemoveFixtureLayoutPackId(item.packId || item.deckId)),
    };
}
