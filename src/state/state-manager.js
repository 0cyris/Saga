/**
 * state-manager.js — Saga
 * State CRUD, settings I/O, migration, delta merging, export/import, and storage safety.
 * Reads reacquire from SillyTavern's context, with one-session migration caching so UI clicks do not repeatedly normalize the full lore matrix.
 *
 * Imports: constants.js
 * Imported by: src/extension/index.js, memo-builder.js, extractor.js, ui.js
 */

import {
    MODULE_KEY,
    LEGACY_MODULE_KEYS,
    DEFAULT_SETTINGS,
    getDefaultState,
    SCHEMA_VERSION,
    LOG_PREFIX,
    AUTOMATION_MODE_VALUES,
    EXPERIENCE_MODE_VALUES,
    BASIC_EXPERIENCE_SETTINGS,
    BASIC_EXPERIENCE_PROFILE_VERSION,
} from './constants.js';
import { normalizeLoreContext, normalizeLoreMatrix, mergeLoreEntries, normalizeLoreEntry, buildLoreGenerationKey, applyLoreLifecycleEvaluation } from '../lorecards/lore-matrix.js';
import { normalizeLoreRelevance, normalizeLoreCanon, normalizeLoreCategory, computeLocalLoreRelevance, normalizeLorePurpose, computeSpecificityScore } from '../lorecards/lore-relevance.js';
import { preprocessPendingLoreEntries } from '../lorecards/pending-lore-preprocessor.js';
import { normalizeLoreTimeline, captureLoreTimelineState, recordLoreTimelineEvent, restoreTimelineEntriesToPending } from '../lorecards/lore-timeline.js';
import { normalizeLoredeckLibraryIndex, normalizePackLibraryMetadata } from '../loredecks/loredeck-library-index.js';
import { GENERATION_RUN_STATUSES, GENERATION_UNIT_STATUSES } from '../generation/generation-job-runner.js';
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

const MAX_CHAT_STATE_BYTES_BEFORE_AUTO_PERSIST = 200000;
const migratedStateRefs = new WeakSet();

const RETIRED_CONTINUITY_CONFIG_KEYS = ['knowledge', 'secrets', 'relationships', 'flags', 'storyMilestones'];
const ACTIVE_CONTINUITY_CHANGE_KEYS = ['canon', 'scene', 'characters', 'inventory', 'objectives', 'threads'];
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
const BUNDLED_THEME_PACK_IDS = Object.freeze([
    'saga-default',
    'royal-chronicle',
    'void-reliquary',
    'stellar-cartography',
    'neon-district',
    'hero-campus',
    'sea-map-odyssey',
    'monster-index',
    'holo-rail',
    'midnight-evidence',
]);
const BUNDLED_THEME_ICON_SET_IDS = Object.freeze([
    'saga-hero',
    'saga-mystic',
    'saga-relay',
]);
const THEME_COLOR_KEYS = Object.freeze([
    'background',
    'backgroundAlt',
    'gradientStart',
    'gradientEnd',
    'surface',
    'surfaceAlt',
    'border',
    'borderStrong',
    'accent',
    'danger',
    'success',
    'warning',
    'focus',
    'button',
    'buttonHover',
    'buttonText',
    'input',
    'inputBorder',
    'text',
    'mutedText',
]);

function disableRetiredContinuitySections(state) {
    if (!state || typeof state !== 'object') return state;
    if (!state.continuityConfig || typeof state.continuityConfig !== 'object' || Array.isArray(state.continuityConfig)) {
        state.continuityConfig = {};
    }
    for (const key of RETIRED_CONTINUITY_CONFIG_KEYS) {
        state.continuityConfig[key] = false;
    }
    return state;
}


function migrateLoreEntryToRelevance(entry = {}, state = {}) {
    const normalized = normalizeLoreEntry(entry);
    const local = computeLocalLoreRelevance(normalized, state, getSettings());
    const previousState = normalized.lifecycle?.status || normalized.lifecycle?.computedStatus || entry.status || '';
    let relevance = normalizeLoreRelevance(entry.relevance || previousState || local.relevance || 'normal');
    if (!entry.relevance) {
        if (['expired', 'archived', 'muted', 'blocked'].includes(String(previousState || '').toLowerCase())) relevance = 'low';
        else if (['active', 'canon_overdue'].includes(String(previousState || '').toLowerCase())) relevance = local.relevance === 'low' ? 'normal' : local.relevance;
        else relevance = local.relevance || relevance;
    }
    const canon = normalizeLoreCanon(entry.canon || entry.canonStatus || normalized.canon, normalized.source || normalized.sourceInfo?.work || '');
    return normalizeLoreEntry({
        ...normalized,
        relevance,
        canon,
        canonStatus: canon,
        category: normalizeLoreCategory(normalized.category),
        extensions: {
            ...(normalized.extensions || {}),
            relevanceMigration: {
                ...(normalized.extensions?.relevanceMigration || {}),
                migratedAt: Date.now(),
                previousLifecycleStatus: previousState || '',
                localRelevanceScore: local.score || 0,
                temporalRole: local.temporalRole || '',
            },
        },
    });
}

function migrateLoreCollectionsToRelevance(state = {}) {
    if (Array.isArray(state.loreMatrix)) state.loreMatrix = state.loreMatrix.map(entry => migrateLoreEntryToRelevance(entry, state));
    if (Array.isArray(state.pendingLoreEntries)) state.pendingLoreEntries = state.pendingLoreEntries.map(entry => migrateLoreEntryToRelevance(entry, state));
    return state;
}

function ensureTierCompressionStatus(state = {}) {
    const defaults = getDefaultState().loreCompressionStatusByRelevance;
    if (!state.loreCompressionStatusByRelevance || typeof state.loreCompressionStatusByRelevance !== 'object') {
        state.loreCompressionStatusByRelevance = JSON.parse(JSON.stringify(defaults));
    } else {
        state.loreCompressionStatusByRelevance = mergeDefaults(state.loreCompressionStatusByRelevance, defaults);
    }
    for (const tier of ['high', 'normal', 'low']) {
        if (!state.loreCompressionStatusByRelevance[tier] || typeof state.loreCompressionStatusByRelevance[tier] !== 'object') {
            state.loreCompressionStatusByRelevance[tier] = { ...defaults[tier] };
        } else {
            state.loreCompressionStatusByRelevance[tier] = mergeDefaults(state.loreCompressionStatusByRelevance[tier], defaults[tier]);
        }
        normalizeCompressionStatusNumbers(state.loreCompressionStatusByRelevance[tier]);
    }
}

function getLoredeckStackItemKey(item = {}) {
    const type = item?.type === 'folder' || item?.folderId ? 'folder' : 'deck';
    const id = type === 'folder'
        ? String(item?.folderId || '').trim()
        : String(item?.packId || item?.deckId || '').trim();
    return id ? `${type}:${id}` : '';
}

function normalizeLoredeckStack(value) {
    const defaultStack = getDefaultState().loredeckStack;
    const input = Array.isArray(value) ? value : defaultStack;
    const output = [];
    const seen = new Set();

    for (const item of input) {
        if (!item || typeof item !== 'object') continue;
        const type = item.type === 'folder' || item.folderId ? 'folder' : 'deck';
        const packId = String(item.packId || item.deckId || '').trim();
        const folderId = String(item.folderId || '').trim();
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

function clearDefaultHpLoredeckFolderStack(value) {
    return isDefaultHpLoredeckFolderStack(value) ? [] : value;
}

function migrateLegacyHpLoredeckRegistry(value) {
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

function migrateLegacyHpLoredeckState(state = {}) {
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

function clearDefaultHpLoredeckStackOnce(state = {}) {
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

function cleanContextString(value, maxLength = 240) {
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

function normalizeLoredeckContext(value, packId = '', legacyContext = {}) {
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

function normalizeLoredeckContexts(value, state = {}) {
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

function cloneLoredeckPlainObject(value, maxLength = 200000) {
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

function normalizeLoredeckEntryOverrides(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    let count = 0;
    for (const [key, raw] of Object.entries(value)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        const entry = normalizeLoreEntry({
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

function normalizeLoredeckDisabledEntryIds(value) {
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

function normalizeLoredeckHealthIssueStates(value) {
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

function normalizeLoredeckPendingChanges(value) {
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

function normalizeLoredeckTagRegistry(value) {
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
            description: String(rawDef.description || '').trim().slice(0, 1000),
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
        sortKeyFrom: normalizeLoredeckTimelineNumber(raw.sortKeyFrom),
        sortKeyTo: normalizeLoredeckTimelineNumber(raw.sortKeyTo),
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

function normalizeLoredeckTimelineRegistry(value) {
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

function normalizeLoredeckRegistry(value, defaults = getDefaultState().loredeckRegistry) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const inputPacks = input.packs && typeof input.packs === 'object' && !Array.isArray(input.packs) ? input.packs : {};
    const defaultPacks = defaults.packs || {};
    const packs = {};
    const importedZipPackIds = new Set();

    const mergedPacks = { ...defaultPacks, ...inputPacks };
    for (const [packId, mergedRaw] of Object.entries(mergedPacks)) {
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
        if (importedZip) importedZipPackIds.add(id);
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
        pack.entryOverrides = normalizeLoredeckEntryOverrides(raw.entryOverrides);
        pack.disabledEntryIds = normalizeLoredeckDisabledEntryIds(raw.disabledEntryIds);
        const tagRegistry = normalizeLoredeckTagRegistry(raw.tagRegistry);
        if (tagRegistry) pack.tagRegistry = tagRegistry;
        const timelineRegistry = normalizeLoredeckTimelineRegistry(raw.timelineRegistry);
        if (timelineRegistry) pack.timelineRegistry = timelineRegistry;
        const pendingChanges = normalizeLoredeckPendingChanges(raw.pendingChanges);
        if (pendingChanges.length) pack.pendingChanges = pendingChanges;
        const healthIssueStates = normalizeLoredeckHealthIssueStates(raw.healthIssueStates);
        if (Object.keys(healthIssueStates).length) pack.healthIssueStates = healthIssueStates;
        packs[id] = pack;
    }
    let registryInput = input;
    if (importedZipPackIds.size) {
        const rawPlacements = Array.isArray(input.deckPlacements) ? input.deckPlacements : [];
        const removedFolderIds = new Set();
        const deckPlacements = rawPlacements.filter(placement => {
            const deckId = String(placement?.deckId || placement?.packId || '').trim();
            if (!importedZipPackIds.has(deckId)) return true;
            const folderId = String(placement?.folderId || '').trim();
            if (folderId) removedFolderIds.add(folderId);
            return false;
        });
        const folders = Array.isArray(input.folders) ? input.folders : [];
        if (removedFolderIds.size && folders.length) {
            const byId = new Map(folders.map(folder => [String(folder?.id || '').trim(), folder]));
            const removalCandidates = new Set();
            for (const folderId of removedFolderIds) {
                let current = byId.get(folderId);
                const seen = new Set();
                while (current?.id && !seen.has(current.id)) {
                    seen.add(current.id);
                    removalCandidates.add(current.id);
                    current = current.parentId ? byId.get(String(current.parentId || '').trim()) : null;
                }
            }
            const remainingPlacementFolders = new Set(deckPlacements.map(placement => String(placement?.folderId || '').trim()).filter(Boolean));
            const stackFolderIds = new Set((Array.isArray(input.activeStack) ? input.activeStack : [])
                .map(item => String(item?.folderId || '').trim())
                .filter(Boolean));
            const hasRemainingUse = folderId => {
                for (const usedId of [...remainingPlacementFolders, ...stackFolderIds]) {
                    let current = byId.get(usedId);
                    const seen = new Set();
                    while (current?.id && !seen.has(current.id)) {
                        seen.add(current.id);
                        if (current.id === folderId) return true;
                        current = current.parentId ? byId.get(String(current.parentId || '').trim()) : null;
                    }
                }
                return false;
            };
            registryInput = {
                ...input,
                folders: folders.filter(folder => {
                    const folderId = String(folder?.id || '').trim();
                    return !removalCandidates.has(folderId) || hasRemainingUse(folderId);
                }),
                deckPlacements,
            };
        } else if (deckPlacements.length !== rawPlacements.length) {
            registryInput = {
                ...input,
                deckPlacements,
            };
        }
    }
    const libraryIndex = normalizeLoredeckLibraryIndex(registryInput, { defaults, packs });

    return {
        schemaVersion: 1,
        packs,
        folders: libraryIndex.folders,
        deckPlacements: libraryIndex.deckPlacements,
        activeStack: libraryIndex.activeStack,
    };
}

function normalizeLoredeckCreatorString(value = '', maxLength = 1000) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

function normalizeLoredeckCreatorStringList(value = [], limit = 80, maxLength = 300) {
    const input = Array.isArray(value) ? value : [];
    const output = [];
    const seen = new Set();
    for (const raw of input) {
        const text = normalizeLoredeckCreatorString(raw, maxLength);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

const CREATOR_GENERATION_RUN_STATUSES = new Set(GENERATION_RUN_STATUSES);
const CREATOR_GENERATION_UNIT_STATUSES = new Set(GENERATION_UNIT_STATUSES);
const CREATOR_ACTIVE_GENERATION_STATUSES = new Set(['queued', 'running', 'retrying']);
const CREATOR_GENERATION_RESULT_STATUSES = new Set(['success', 'warning', 'error', 'cancelled', 'complete', 'partial', 'failed', 'superseded', 'interrupted']);

function normalizeLoredeckCreatorId(value = '', fallback = '') {
    const text = normalizeLoredeckCreatorString(value, 220)
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return text || fallback;
}

function normalizeLoredeckCreatorNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function normalizeLoredeckCreatorGenerationStatus(value = '', allowed = CREATOR_GENERATION_UNIT_STATUSES, fallback = 'queued') {
    const status = normalizeLoredeckCreatorString(value, 60).toLowerCase();
    return allowed.has(status) ? status : fallback;
}

function normalizeLoredeckCreatorResultRef(value = {}, maxLength = 12000) {
    const cloned = cloneLoredeckPlainObject(value, maxLength);
    return cloned && typeof cloned === 'object' && !Array.isArray(cloned) ? cloned : null;
}

function normalizeLoredeckCreatorGenerationRun(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const runId = normalizeLoredeckCreatorId(value.runId || value.id || '', `run_${index + 1}`);
    if (!runId) return null;
    const run = {
        runId,
        id: normalizeLoredeckCreatorId(value.id || runId, runId),
        jobId: normalizeLoredeckCreatorId(value.jobId || '', ''),
        kind: normalizeLoredeckCreatorId(value.kind || 'loredeck_creator', 'loredeck_creator'),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        mode: normalizeLoredeckCreatorId(value.mode || 'run_next', 'run_next'),
        status: normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_RUN_STATUSES, 'queued'),
        totalUnits: normalizeLoredeckCreatorNumber(value.totalUnits),
        completedUnits: normalizeLoredeckCreatorNumber(value.completedUnits),
        failedUnits: normalizeLoredeckCreatorNumber(value.failedUnits),
        skippedUnits: normalizeLoredeckCreatorNumber(value.skippedUnits),
        cancelledUnits: normalizeLoredeckCreatorNumber(value.cancelledUnits),
        currentUnitId: normalizeLoredeckCreatorId(value.currentUnitId || '', ''),
        currentUnitIndex: Number.isFinite(Number(value.currentUnitIndex)) ? Math.max(0, Math.round(Number(value.currentUnitIndex))) : 0,
        error: normalizeLoredeckCreatorString(value.error, 800),
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
    };
    const meta = normalizeLoredeckCreatorResultRef(value.meta, 12000);
    if (meta) run.meta = meta;
    return run;
}

function normalizeLoredeckCreatorGenerationUnit(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const unitId = normalizeLoredeckCreatorId(value.unitId || value.id || value.batchId || '', `unit_${index + 1}`);
    if (!unitId) return null;
    const unit = {
        unitId,
        id: normalizeLoredeckCreatorId(value.id || unitId, unitId),
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        jobId: normalizeLoredeckCreatorId(value.jobId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        label: normalizeLoredeckCreatorString(value.label || value.title || unitId, 180),
        status: normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_UNIT_STATUSES, 'queued'),
        attempts: normalizeLoredeckCreatorNumber(value.attempts),
        inputHash: normalizeLoredeckCreatorString(value.inputHash, 160),
        outputHash: normalizeLoredeckCreatorString(value.outputHash, 160),
        error: normalizeLoredeckCreatorString(value.error, 800),
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
        failedAt: Number.isFinite(Number(value.failedAt)) ? Number(value.failedAt) : 0,
    };
    const resultRef = normalizeLoredeckCreatorResultRef(value.resultRef, 12000);
    if (resultRef) unit.resultRef = resultRef;
    const meta = normalizeLoredeckCreatorResultRef(value.meta, 12000);
    if (meta) unit.meta = meta;
    return unit;
}

function normalizeLoredeckCreatorGenerationMap(value = {}, normalizer, idKey = 'id', limit = 200) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {};
    const rows = Object.entries(input)
        .map(([key, raw], index) => normalizer({ ...(raw || {}), [idKey]: raw?.[idKey] || key }, index))
        .filter(Boolean)
        .sort((a, b) => (Number(b.updatedAt || b.completedAt || b.startedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.completedAt || a.startedAt || a.createdAt) || 0))
        .slice(0, Math.max(1, Number(limit) || 200));
    for (const row of rows) output[row[idKey]] = row;
    return output;
}

function normalizeLoredeckCreatorActiveGeneration(value = {}, jobId = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const status = normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_ACTIVE_GENERATION_STATUSES, '');
    if (!status) return null;
    const id = normalizeLoredeckCreatorId(value.id || value.runId || value.unitId || '', '');
    if (!id) return null;
    const rawCurrentStage = normalizeLoredeckCreatorString(value.currentStage || value.uiStage || '', 80);
    const normalizedCurrentStage = rawCurrentStage ? normalizeLoredeckCreatorStage(rawCurrentStage) : '';
    const active = {
        id,
        jobId: normalizeLoredeckCreatorId(value.jobId || jobId || '', ''),
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        unitId: normalizeLoredeckCreatorId(value.unitId || '', ''),
        actionId: normalizeLoredeckCreatorId(value.actionId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        currentStage: normalizedCurrentStage === 'intake' && rawCurrentStage !== 'intake' ? '' : normalizedCurrentStage,
        label: normalizeLoredeckCreatorString(value.label || 'Generation running', 180),
        status,
        phase: normalizeLoredeckCreatorString(value.phase || 'running', 80),
        message: normalizeLoredeckCreatorString(value.message || '', 300),
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        elapsedMs: normalizeLoredeckCreatorNumber(value.elapsedMs),
        receivedChars: normalizeLoredeckCreatorNumber(value.receivedChars),
        snippet: normalizeLoredeckCreatorString(value.snippet, 500),
        streamRequested: value.streamRequested === true,
        streamSupported: value.streamSupported === true ? true : value.streamSupported === false ? false : null,
        abortable: value.abortable === true,
        batchId: normalizeLoredeckCreatorId(value.batchId || '', ''),
        batchLabel: normalizeLoredeckCreatorString(value.batchLabel || '', 180),
        batchIndex: Number.isFinite(Number(value.batchIndex)) ? Math.max(0, Math.round(Number(value.batchIndex))) : null,
        batchTotal: Number.isFinite(Number(value.batchTotal)) ? Math.max(0, Math.round(Number(value.batchTotal))) : null,
    };
    return active;
}

function normalizeLoredeckCreatorGenerationResult(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeLoredeckCreatorId(value.id || value.runId || value.unitId || '', '');
    if (!id) return null;
    const status = normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_RESULT_STATUSES, 'complete');
    const result = {
        id,
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        unitId: normalizeLoredeckCreatorId(value.unitId || '', ''),
        actionId: normalizeLoredeckCreatorId(value.actionId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        label: normalizeLoredeckCreatorString(value.label || 'Generation', 180),
        status,
        message: normalizeLoredeckCreatorString(value.message || '', 500),
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
        elapsedMs: normalizeLoredeckCreatorNumber(value.elapsedMs),
        receivedChars: normalizeLoredeckCreatorNumber(value.receivedChars),
        snippet: normalizeLoredeckCreatorString(value.snippet, 500),
        streamSupported: value.streamSupported === true ? true : value.streamSupported === false ? false : null,
        batchId: normalizeLoredeckCreatorId(value.batchId || '', ''),
        batchLabel: normalizeLoredeckCreatorString(value.batchLabel || '', 180),
    };
    return result;
}

function normalizeLoredeckCreatorStage(value = '') {
    const stage = normalizeLoredeckCreatorString(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return [
        'intake',
        'brief_drafted',
        'brief_approved',
        'outline_drafting',
        'outline_drafted',
        'outline_approved',
        'context_drafted',
        'tags_drafted',
        'titles_drafting',
        'titles_drafted',
        'titles_approved',
        'planning_drafting',
        'planning_queued',
        'planning_accepted',
        'entries_drafting',
        'entries_drafted',
        'health_review',
        'complete',
        'blocked',
    ].includes(stage) ? stage : 'intake';
}

function inferLoredeckCreatorStage(job = {}) {
    if (job.activeGeneration?.status && CREATOR_ACTIVE_GENERATION_STATUSES.has(String(job.activeGeneration.status).toLowerCase())) {
        const activeStage = normalizeLoredeckCreatorStage(job.activeGeneration.currentStage || job.activeGeneration.stage || '');
        if (activeStage && activeStage !== 'intake') return activeStage;
    }
    if (job.currentStage) return normalizeLoredeckCreatorStage(job.currentStage);
    if (job.entryDraftCount || job.entryDraftedAt) return 'entries_drafted';
    if (job.generatedPackId && (job.planningQueuedCount || job.planningQueuedAt)) return 'planning_queued';
    if (Array.isArray(job.approvedTitleDraftIds) && job.approvedTitleDraftIds.length) return 'titles_approved';
    if (Array.isArray(job.titleDrafts) && job.titleDrafts.length) return 'titles_drafted';
    if (job.outlineApproved && job.outline) return 'outline_approved';
    if (job.outline) return 'outline_drafted';
    if (job.approved) return 'brief_approved';
    if (job.brief) return 'brief_drafted';
    return 'intake';
}

function normalizeLoredeckCreatorJob(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const intake = value.intake && typeof value.intake === 'object' && !Array.isArray(value.intake) ? value.intake : {};
    const now = Date.now();
    const fallbackIdSeed = `${value.fandom || intake.fandom || 'creator'}-${value.scope || intake.scope || index + 1}-${value.createdAt || now}`;
    const jobId = normalizeLoredeckCreatorString(value.jobId || value.id || '', 160)
        || `creator_${String(fallbackIdSeed).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || index + 1}`;
    const titleDrafts = Array.isArray(value.titleDrafts)
        ? value.titleDrafts.map(item => cloneLoredeckPlainObject(item, 30000)).filter(Boolean).slice(0, 1200)
        : [];
    const selectedTitleDraftIds = normalizeLoredeckCreatorStringList(value.selectedTitleDraftIds, 1200, 180);
    const approvedTitleDraftIds = normalizeLoredeckCreatorStringList(value.approvedTitleDraftIds, 1200, 180);
    const titleBatchDraftedIds = normalizeLoredeckCreatorStringList(value.titleBatchDraftedIds, 1200, 180);
    const planningBatchQueuedIds = normalizeLoredeckCreatorStringList(value.planningBatchQueuedIds, 1200, 180);
    const planningBatchAcceptedIds = normalizeLoredeckCreatorStringList(value.planningBatchAcceptedIds, 1200, 180);
    const generationRuns = normalizeLoredeckCreatorGenerationMap(value.generationRuns, normalizeLoredeckCreatorGenerationRun, 'runId', 80);
    const generationUnits = normalizeLoredeckCreatorGenerationMap(value.generationUnits, normalizeLoredeckCreatorGenerationUnit, 'unitId', 1200);
    const job = {
        schemaVersion: 1,
        jobId,
        status: normalizeLoredeckCreatorString(value.status || (value.blocked ? 'blocked' : 'draft'), 80) || 'draft',
        currentStage: inferLoredeckCreatorStage(value),
        archived: value.archived === true,
        fandom: normalizeLoredeckCreatorString(value.fandom || intake.fandom, 200),
        scope: normalizeLoredeckCreatorString(value.scope || intake.scope, 500),
        granularity: normalizeLoredeckCreatorString(value.granularity || intake.granularity || 'focused', 80) || 'focused',
        notes: normalizeLoredeckCreatorString(value.notes || intake.notes, 4000),
        summary: normalizeLoredeckCreatorString(value.summary, 1500),
        questions: normalizeLoredeckCreatorStringList(value.questions || value.clarifyingQuestions, 20, 400),
        warnings: normalizeLoredeckCreatorStringList(value.warnings, 40, 400),
        approved: value.approved === true,
        outlineApproved: value.outlineApproved === true,
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : now,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
    };
    const brief = cloneLoredeckPlainObject(value.brief, 60000);
    if (brief) job.brief = brief;
    const outline = cloneLoredeckPlainObject(value.outline, 80000);
    if (outline) job.outline = outline;
    for (const key of [
        'approvedAt',
        'outlineDraftedAt',
        'outlineRevisedAt',
        'outlineApprovedAt',
        'approvedTitleDraftAt',
        'titleDraftedAt',
        'titleRevisedAt',
        'planningQueuedAt',
        'planningAcceptedAt',
        'entryDraftedAt',
        'lastStartedAt',
        'lastCompletedAt',
        'lastFailedAt',
        'archivedAt',
    ]) {
        if (Number.isFinite(Number(value[key]))) job[key] = Number(value[key]);
    }
    if (titleDrafts.length) job.titleDrafts = titleDrafts;
    if (selectedTitleDraftIds.length) job.selectedTitleDraftIds = selectedTitleDraftIds;
    if (approvedTitleDraftIds.length) job.approvedTitleDraftIds = approvedTitleDraftIds;
    if (titleBatchDraftedIds.length) job.titleBatchDraftedIds = titleBatchDraftedIds;
    if (planningBatchQueuedIds.length) job.planningBatchQueuedIds = planningBatchQueuedIds;
    if (planningBatchAcceptedIds.length) job.planningBatchAcceptedIds = planningBatchAcceptedIds;
    job.generationRuns = generationRuns;
    job.generationUnits = generationUnits;
    const activeGeneration = normalizeLoredeckCreatorActiveGeneration(value.activeGeneration, jobId);
    if (activeGeneration) job.activeGeneration = activeGeneration;
    const lastGenerationResult = normalizeLoredeckCreatorGenerationResult(value.lastGenerationResult);
    if (lastGenerationResult) job.lastGenerationResult = lastGenerationResult;

    const objectFields = {
        titleBatch: 20000,
        stageStatus: 50000,
        batches: 100000,
        generationSettings: 12000,
    };
    for (const [key, maxLength] of Object.entries(objectFields)) {
        const cloned = cloneLoredeckPlainObject(value[key], maxLength);
        if (cloned) job[key] = cloned;
    }

    for (const key of [
        'titlePassSummary',
        'outlineSummary',
        'planningSummary',
        'entryDraftSummary',
        'generatedPackId',
        'generatedPackTitle',
        'planningCurrentBatchId',
        'planningCurrentBatchLabel',
        'entryDraftCurrentBatchId',
        'entryDraftCurrentBatchLabel',
        'folderId',
        'projectTitle',
        'lastAction',
    ]) {
        const text = normalizeLoredeckCreatorString(value[key], key.includes('Summary') ? 1500 : 200);
        if (text) job[key] = text;
    }
    for (const key of ['outlineQuestions', 'outlineWarnings', 'titlePassQuestions', 'titlePassWarnings', 'planningQuestions', 'planningWarnings', 'entryDraftQuestions', 'entryDraftWarnings']) {
        const list = normalizeLoredeckCreatorStringList(value[key], 40, 400);
        if (list.length) job[key] = list;
    }
    for (const key of [
        'planningQueuedCount',
        'entryDraftCount',
        'entryDraftLastBatchCount',
        'entryDraftLastTargetCount',
        'entryDraftRemainingCount',
        'entryDraftBatchSize',
    ]) {
        if (Number.isFinite(Number(value[key]))) job[key] = Math.max(0, Math.round(Number(value[key])));
    }
    const errors = normalizeLoredeckCreatorStringList(value.errors, 40, 500);
    if (errors.length) job.errors = errors;
    return job;
}

function normalizeLoredeckCreatorRegistry(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const jobs = {};
    const rawJobs = input.jobs && typeof input.jobs === 'object' && !Array.isArray(input.jobs) ? input.jobs : {};
    let count = 0;
    for (const [key, raw] of Object.entries(rawJobs)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const job = normalizeLoredeckCreatorJob({ ...(raw || {}), jobId: raw?.jobId || key }, count);
        if (!job) continue;
        jobs[job.jobId] = job;
        count += 1;
        if (count >= 200) break;
    }
    const activeJobId = normalizeLoredeckCreatorString(input.activeJobId, 160);
    const lastJobId = normalizeLoredeckCreatorString(input.lastJobId, 160);
    const fallbackActive = jobs[activeJobId] ? activeJobId : (jobs[lastJobId] ? lastJobId : Object.keys(jobs)[0] || '');
    return {
        schemaVersion: 1,
        activeJobId: fallbackActive,
        lastJobId: jobs[lastJobId] ? lastJobId : fallbackActive,
        jobs,
    };
}

function mergeLoredeckCreatorRegistries(globalRegistry = {}, localRegistry = {}, options = {}) {
    const globalNormalized = normalizeLoredeckCreatorRegistry(globalRegistry);
    const localNormalized = normalizeLoredeckCreatorRegistry(localRegistry);
    const jobs = {};
    const addJob = job => {
        if (!job?.jobId) return;
        const existing = jobs[job.jobId];
        if (!existing || (Number(job.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
            jobs[job.jobId] = job;
        }
    };
    for (const job of Object.values(globalNormalized.jobs || {})) addJob(job);
    for (const job of Object.values(localNormalized.jobs || {})) addJob(job);
    const preferLocalActive = options.preferLocalActive !== false;
    const activeJobId = preferLocalActive && localNormalized.activeJobId && jobs[localNormalized.activeJobId]
        ? localNormalized.activeJobId
        : (globalNormalized.activeJobId && jobs[globalNormalized.activeJobId]
            ? globalNormalized.activeJobId
            : (localNormalized.activeJobId && jobs[localNormalized.activeJobId]
                ? localNormalized.activeJobId
                : ''));
    const lastJobId = preferLocalActive && localNormalized.lastJobId && jobs[localNormalized.lastJobId]
        ? localNormalized.lastJobId
        : (globalNormalized.lastJobId && jobs[globalNormalized.lastJobId]
            ? globalNormalized.lastJobId
            : (activeJobId || ''));
    return normalizeLoredeckCreatorRegistry({
        schemaVersion: 1,
        activeJobId,
        lastJobId,
        jobs,
    });
}

function getLoredeckCreatorSettingsRegistry(settings = getSettings()) {
    return normalizeLoredeckCreatorRegistry(settings.loredeckCreatorProjects || DEFAULT_SETTINGS.loredeckCreatorProjects);
}

function getMostRecentLoredeckCreatorJob(registry = {}) {
    return Object.values(registry.jobs || {})
        .filter(job => job?.jobId)
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0] || null;
}

function normalizeLoredeckCreatorPackIdCandidate(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .slice(0, 96);
}

function getLoredeckCreatorJobGeneratedPackIdCandidates(job = {}) {
    const values = [
        job?.generatedPackId,
        job?.brief?.packId,
        job?.brief?.title,
    ];
    const output = [];
    const seen = new Set();
    for (const value of values) {
        for (const candidate of [
            normalizeLoredeckCreatorString(value, 200),
            normalizeLoredeckCreatorPackIdCandidate(value),
        ]) {
            if (!candidate || seen.has(candidate)) continue;
            seen.add(candidate);
            output.push(candidate);
        }
    }
    return output;
}

function removeLoredeckCreatorJobsForGeneratedPackId(registry = {}, packId = '') {
    const id = normalizeLoredeckCreatorString(packId, 200);
    const normalizedId = normalizeLoredeckCreatorPackIdCandidate(packId);
    const targetIds = new Set([id, normalizedId].filter(Boolean));
    const next = normalizeLoredeckCreatorRegistry(registry);
    if (!targetIds.size || !Object.keys(next.jobs || {}).length) {
        return { registry: next, removedJobIds: [] };
    }

    const removedJobIds = [];
    for (const [jobId, job] of Object.entries(next.jobs || {})) {
        if (!getLoredeckCreatorJobGeneratedPackIdCandidates(job).some(candidate => targetIds.has(candidate))) continue;
        delete next.jobs[jobId];
        removedJobIds.push(jobId);
    }
    if (!removedJobIds.length) return { registry: next, removedJobIds };

    const removed = new Set(removedJobIds);
    if (removed.has(next.activeJobId)) next.activeJobId = '';
    if (removed.has(next.lastJobId)) next.lastJobId = '';
    const nextActive = getMostRecentLoredeckCreatorJob(next);
    if (nextActive) {
        next.activeJobId = nextActive.jobId;
        next.lastJobId = nextActive.jobId;
    }
    return {
        registry: normalizeLoredeckCreatorRegistry(next),
        removedJobIds,
    };
}

function normalizeThemeHexColor(value) {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
    }
    return '';
}

function normalizeThemeColorMap(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const colors = {};
    for (const key of THEME_COLOR_KEYS) {
        const color = normalizeThemeHexColor(input[key]);
        if (color) colors[key] = color;
    }
    return colors;
}

function normalizeThemeIconMap(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const icons = {};
    let count = 0;
    for (const [rawKey, rawValue] of Object.entries(input)) {
        const key = String(rawKey || '').trim().slice(0, 80);
        const icon = String(rawValue || '').trim().slice(0, 500);
        if (!key || !icon) continue;
        icons[key] = icon;
        count += 1;
        if (count >= 80) break;
    }
    return icons;
}

function looksLikeThemeIconMap(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.keys(input).some(key => /^(?:tab\.|brand\.|control\.|loredecks$|lorecards$|session$|context$|continuity$|lore$|injection$|settings$|collapse$)/i.test(String(key || '').trim()));
}

function normalizeThemeIconSetRegistry(value, defaults = DEFAULT_SETTINGS.themeIconSetLibrary) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const inputIconSets = input.iconSets && typeof input.iconSets === 'object' && !Array.isArray(input.iconSets)
        ? input.iconSets
        : {};
    const defaultIconSets = defaults?.iconSets || defaults?.packs || {};
    const iconSets = {};

    for (const [iconSetId, raw] of Object.entries({ ...defaultIconSets, ...inputIconSets })) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || raw.iconSetId || iconSetId || '').trim();
        if (!id) continue;
        const rawIcons = raw.icons && typeof raw.icons === 'object' && !Array.isArray(raw.icons)
            ? raw.icons
            : (looksLikeThemeIconMap(raw) ? raw : {});
        const icons = normalizeThemeIconMap(rawIcons);
        if (!Object.keys(icons).length) continue;
        const isBundledDefault = defaultIconSets[id]?.type === 'bundled' || BUNDLED_THEME_ICON_SET_IDS.includes(id);
        const type = raw.type === 'bundled' && isBundledDefault ? 'bundled' : 'custom';
        const source = raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source) ? raw.source : {};
        iconSets[id] = {
            schemaVersion: 1,
            id,
            type,
            title: String(raw.title || id).trim(),
            description: String(raw.description || '').trim(),
            author: String(raw.author || '').trim(),
            version: String(raw.version || '').trim(),
            preferredSize: Math.max(16, Math.min(2048, Math.round(Number(raw.preferredSize) || 256))),
            icons,
            source: {
                kind: String(source.kind || (type === 'bundled' ? 'bundled' : 'local')).trim(),
                url: String(source.url || '').trim(),
                updateUrl: String(source.updateUrl || '').trim(),
            },
            tags: Array.isArray(raw.tags) ? raw.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 64) : [],
            installedAt: Number.isFinite(Number(raw.installedAt)) ? Number(raw.installedAt) : 0,
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
        };
    }

    return {
        schemaVersion: 1,
        iconSets,
    };
}

function normalizeThemePackRegistry(value, defaults = DEFAULT_SETTINGS.themePackLibrary) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const inputPacks = input.packs && typeof input.packs === 'object' && !Array.isArray(input.packs) ? input.packs : {};
    const defaultPacks = defaults?.packs || {};
    const packs = {};

    for (const [themeId, raw] of Object.entries({ ...defaultPacks, ...inputPacks })) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || raw.themeId || themeId || '').trim();
        if (!id) continue;
        const isBundledDefault = defaultPacks[id]?.type === 'bundled' || BUNDLED_THEME_PACK_IDS.includes(id);
        const type = raw.type === 'bundled' && isBundledDefault ? 'bundled' : 'custom';
        const source = raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source) ? raw.source : {};
        const pack = {
            id,
            type,
            title: String(raw.title || id).trim(),
            description: String(raw.description || '').trim(),
            author: String(raw.author || '').trim(),
            version: String(raw.version || '').trim(),
            colors: normalizeThemeColorMap(raw.colors),
            source: {
                kind: String(source.kind || (type === 'bundled' ? 'bundled' : 'local')).trim(),
                url: String(source.url || '').trim(),
                updateUrl: String(source.updateUrl || '').trim(),
            },
            tags: Array.isArray(raw.tags) ? raw.tags.map(tag => String(tag || '').trim()).filter(Boolean).slice(0, 64) : [],
            installedAt: Number.isFinite(Number(raw.installedAt)) ? Number(raw.installedAt) : 0,
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
        };
        packs[id] = pack;
    }

    return {
        schemaVersion: 1,
        packs,
    };
}

export function getThemePackLibraryRegistry() {
    const settings = getSettings();
    return normalizeThemePackRegistry(settings.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary);
}

export function getThemeIconSetLibraryRegistry() {
    const settings = getSettings();
    return normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, DEFAULT_SETTINGS.themeIconSetLibrary);
}

export function upsertThemePackLibraryPack(packRecord = {}) {
    if (packRecord?.icons) {
        return { ok: false, error: 'Theme Packs cannot contain Icon Set fields. Import Icon Sets separately.' };
    }
    const normalized = normalizeThemePackRegistry(
        { schemaVersion: 1, packs: { [packRecord.id || packRecord.themeId || '']: { ...packRecord, type: 'custom' } } },
        { schemaVersion: 1, packs: {} }
    );
    const [themeId, pack] = Object.entries(normalized.packs || {})[0] || [];
    if (!themeId || !pack) {
        return { ok: false, error: 'Theme Pack record must include an id.' };
    }
    if (BUNDLED_THEME_PACK_IDS.includes(themeId)) {
        return { ok: false, error: 'Custom Theme Packs cannot replace a Bundled Theme Pack with the same id.' };
    }

    const settings = getSettings();
    const library = normalizeThemePackRegistry(settings.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary);
    library.packs[themeId] = {
        ...(library.packs[themeId] || {}),
        ...pack,
        installedAt: library.packs[themeId]?.installedAt || pack.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    settings.themePackLibrary = library;
    saveSettings(settings);
    return { ok: true, pack: library.packs[themeId], library };
}

export function removeThemePackLibraryPack(themeId, options = {}) {
    const id = String(themeId || '').trim();
    if (!id) return { ok: false, error: 'Missing Theme Pack id.' };
    if (options.allowBundled !== true && BUNDLED_THEME_PACK_IDS.includes(id)) {
        return { ok: false, error: 'Bundled Theme Packs cannot be removed from the library.' };
    }

    const settings = getSettings();
    const library = normalizeThemePackRegistry(settings.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary);
    if (!library.packs[id]) return { ok: false, error: 'Theme Pack is not installed.' };
    delete library.packs[id];
    settings.themePackLibrary = normalizeThemePackRegistry(library, DEFAULT_SETTINGS.themePackLibrary);
    saveSettings(settings);
    return { ok: true, library: settings.themePackLibrary };
}

export function importThemePackLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeThemePackRegistry(registry, { schemaVersion: 1, packs: {} });
    const rawPacks = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs) ? registry.packs : {};
    const settings = getSettings();
    const current = options.replace === true
        ? normalizeThemePackRegistry(DEFAULT_SETTINGS.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary)
        : normalizeThemePackRegistry(settings.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary);

    let importedCount = 0;
    let skippedCount = 0;
    for (const [themeId, pack] of Object.entries(incoming.packs || {})) {
        const raw = rawPacks[themeId] || {};
        if (BUNDLED_THEME_PACK_IDS.includes(themeId) || raw.icons) {
            skippedCount += 1;
            continue;
        }
        current.packs[themeId] = {
            ...(current.packs[themeId] || {}),
            ...pack,
            type: 'custom',
            installedAt: current.packs[themeId]?.installedAt || pack.installedAt || Date.now(),
            updatedAt: Date.now(),
        };
        importedCount += 1;
    }

    settings.themePackLibrary = normalizeThemePackRegistry(current, DEFAULT_SETTINGS.themePackLibrary);
    saveSettings(settings);
    return { ok: true, importedCount, skippedCount, library: settings.themePackLibrary };
}

export function upsertThemeIconSetLibraryPack(iconSetRecord = {}) {
    const normalized = normalizeThemeIconSetRegistry(
        { schemaVersion: 1, iconSets: { [iconSetRecord.id || iconSetRecord.iconSetId || '']: { ...iconSetRecord, type: 'custom' } } },
        { schemaVersion: 1, iconSets: {} }
    );
    const [iconSetId, iconSet] = Object.entries(normalized.iconSets || {})[0] || [];
    if (!iconSetId || !iconSet) {
        return { ok: false, error: 'Icon Set record must include an id and icons.' };
    }
    if (BUNDLED_THEME_ICON_SET_IDS.includes(iconSetId)) {
        return { ok: false, error: 'Custom Icon Sets cannot replace a Bundled Icon Set with the same id.' };
    }

    const settings = getSettings();
    const library = normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, DEFAULT_SETTINGS.themeIconSetLibrary);
    library.iconSets[iconSetId] = {
        ...(library.iconSets[iconSetId] || {}),
        ...iconSet,
        installedAt: library.iconSets[iconSetId]?.installedAt || iconSet.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    settings.themeIconSetLibrary = library;
    saveSettings(settings);
    return { ok: true, iconSet: library.iconSets[iconSetId], library };
}

export function importThemeIconSetLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeThemeIconSetRegistry(registry, { schemaVersion: 1, iconSets: {} });
    const settings = getSettings();
    const current = options.replace === true
        ? normalizeThemeIconSetRegistry(DEFAULT_SETTINGS.themeIconSetLibrary, DEFAULT_SETTINGS.themeIconSetLibrary)
        : normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, DEFAULT_SETTINGS.themeIconSetLibrary);

    let importedCount = 0;
    let skippedCount = 0;
    for (const [iconSetId, iconSet] of Object.entries(incoming.iconSets || {})) {
        if (BUNDLED_THEME_ICON_SET_IDS.includes(iconSetId)) {
            skippedCount += 1;
            continue;
        }
        current.iconSets[iconSetId] = {
            ...(current.iconSets[iconSetId] || {}),
            ...iconSet,
            type: 'custom',
            installedAt: current.iconSets[iconSetId]?.installedAt || iconSet.installedAt || Date.now(),
            updatedAt: Date.now(),
        };
        importedCount += 1;
    }

    settings.themeIconSetLibrary = normalizeThemeIconSetRegistry(current, DEFAULT_SETTINGS.themeIconSetLibrary);
    saveSettings(settings);
    return { ok: true, importedCount, skippedCount, library: settings.themeIconSetLibrary };
}

function createLoredeckCreatorJobId(seed = '') {
    const stem = normalizeLoredeckCreatorString(seed, 100)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'creator';
    return `${stem}_${Date.now().toString(36)}`;
}

export function getLoredeckCreatorRegistry(state = null) {
    const source = state || getState();
    return mergeLoredeckCreatorRegistries(
        getLoredeckCreatorSettingsRegistry(),
        normalizeLoredeckCreatorRegistry(source?.loredeckCreator || getDefaultState().loredeckCreator),
        { preferLocalActive: !!source?.loredeckCreator?.activeJobId }
    );
}

export function getLoredeckCreatorProjectRegistry() {
    return getLoredeckCreatorSettingsRegistry();
}

export function getActiveLoredeckCreatorJob(state = null) {
    const registry = getLoredeckCreatorRegistry(state);
    return registry.activeJobId ? (registry.jobs[registry.activeJobId] || null) : null;
}

export function upsertLoredeckCreatorJob(jobRecord = {}, options = {}) {
    const state = getState();
    const registry = getLoredeckCreatorRegistry(state);
    const active = registry.activeJobId ? registry.jobs[registry.activeJobId] : null;
    const requestedJobId = normalizeLoredeckCreatorString(jobRecord.jobId, 160);
    const existing = requestedJobId ? (registry.jobs[requestedJobId] || null) : active;
    const base = existing || (!requestedJobId ? active : null);
    const seed = `${jobRecord.fandom || base?.fandom || active?.fandom || 'creator'}-${jobRecord.scope || base?.scope || active?.scope || ''}`;
    const job = normalizeLoredeckCreatorJob({
        ...(base || {}),
        ...(jobRecord || {}),
        jobId: requestedJobId || base?.jobId || active?.jobId || createLoredeckCreatorJobId(seed),
        updatedAt: Date.now(),
    });
    if (!job) return { ok: false, error: 'Creator job could not be normalized.' };

    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    projectRegistry.jobs[job.jobId] = job;
    projectRegistry.activeJobId = job.jobId;
    projectRegistry.lastJobId = job.jobId;
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
    saveSettings(settings);

    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    localRegistry.jobs[job.jobId] = job;
    localRegistry.activeJobId = job.jobId;
    localRegistry.lastJobId = job.jobId;
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
    return {
        ok: true,
        job: state.loredeckCreator.jobs[job.jobId],
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: settings.loredeckCreatorProjects,
    };
}

export function activateLoredeckCreatorJob(jobId = '', options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };

    const state = getState();
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    const sourceJob = projectRegistry.jobs[id] || localRegistry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Creator project was not found.' };

    const job = normalizeLoredeckCreatorJob({
        ...sourceJob,
        jobId: id,
        updatedAt: sourceJob.updatedAt || Date.now(),
    });
    if (!job) return { ok: false, error: 'Creator project could not be normalized.' };

    projectRegistry.jobs[job.jobId] = job;
    projectRegistry.activeJobId = job.jobId;
    projectRegistry.lastJobId = job.jobId;
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
    saveSettings(settings);

    localRegistry.jobs[job.jobId] = job;
    localRegistry.activeJobId = job.jobId;
    localRegistry.lastJobId = job.jobId;
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });

    return {
        ok: true,
        job: state.loredeckCreator.jobs[job.jobId],
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: settings.loredeckCreatorProjects,
    };
}

export function updateLoredeckCreatorProject(jobId = '', patch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return { ok: false, error: 'Creator project update must be an object.' };
    }

    const state = getState();
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    const sourceJob = projectRegistry.jobs[id] || localRegistry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Creator project was not found.' };

    const projectActiveJobId = projectRegistry.activeJobId;
    const projectLastJobId = projectRegistry.lastJobId;
    const localActiveJobId = localRegistry.activeJobId;
    const localLastJobId = localRegistry.lastJobId;
    const updatedAt = options.touchUpdatedAt === false
        ? (Number(sourceJob.updatedAt) || Date.now())
        : Date.now();
    const job = normalizeLoredeckCreatorJob({
        ...sourceJob,
        ...patch,
        jobId: id,
        updatedAt,
    });
    if (!job) return { ok: false, error: 'Creator project could not be normalized.' };

    projectRegistry.jobs[id] = job;
    projectRegistry.activeJobId = projectActiveJobId;
    projectRegistry.lastJobId = projectLastJobId;
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
    saveSettings(settings);

    if (localRegistry.jobs[id] || localRegistry.activeJobId === id || options.syncLocal === true) {
        localRegistry.jobs[id] = job;
        localRegistry.activeJobId = localActiveJobId;
        localRegistry.lastJobId = localLastJobId;
        state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
        saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
    }

    return {
        ok: true,
        job,
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: settings.loredeckCreatorProjects,
    };
}

export function setLoredeckCreatorActiveGeneration(jobId = '', activeGeneration = null, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };
    const normalizedActive = normalizeLoredeckCreatorActiveGeneration(activeGeneration, id);
    const sourceJob = getLoredeckCreatorRegistry(getState()).jobs[id] || null;
    return updateLoredeckCreatorProject(id, {
        activeGeneration: normalizedActive || null,
        ...(normalizedActive ? {
            status: 'running',
            currentStage: normalizedActive.currentStage || normalizedActive.stage || '',
        } : (sourceJob?.status === 'running' ? { status: sourceJob.complete ? 'complete' : 'draft' } : {})),
    }, { ...options, syncLocal: true });
}

export function updateLoredeckCreatorGenerationRun(jobId = '', runPatch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };
    if (!runPatch || typeof runPatch !== 'object' || Array.isArray(runPatch)) {
        return { ok: false, error: 'Creator generation run update must be an object.' };
    }
    const registry = getLoredeckCreatorRegistry(getState());
    const sourceJob = registry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Creator project was not found.' };
    const runId = normalizeLoredeckCreatorId(runPatch.runId || runPatch.id || sourceJob.activeGeneration?.runId || '', '');
    if (!runId) return { ok: false, error: 'Missing Creator generation run id.' };

    const generationRuns = {
        ...(sourceJob.generationRuns || {}),
    };
    const previous = generationRuns[runId] || {};
    const run = normalizeLoredeckCreatorGenerationRun({
        ...previous,
        ...runPatch,
        runId,
        jobId: id,
        updatedAt: Number.isFinite(Number(runPatch.updatedAt)) ? Number(runPatch.updatedAt) : Date.now(),
    }, Object.keys(generationRuns).length);
    if (!run) return { ok: false, error: 'Creator generation run could not be normalized.' };
    generationRuns[run.runId] = run;

    const patch = { generationRuns };
    if (options.activate === true || (run.status === 'running' && options.activate !== false)) {
        const currentStage = options.currentStage || sourceJob.activeGeneration?.currentStage || sourceJob.currentStage || run.stage || '';
        patch.activeGeneration = {
            ...(sourceJob.activeGeneration || {}),
            id: sourceJob.activeGeneration?.id || run.runId,
            jobId: id,
            runId: run.runId,
            stage: run.stage,
            currentStage,
            status: 'running',
            phase: run.status,
            label: options.label || sourceJob.activeGeneration?.label || 'Generation running',
            startedAt: run.startedAt || Date.now(),
            updatedAt: run.updatedAt || Date.now(),
        };
        patch.status = 'running';
        if (currentStage) patch.currentStage = currentStage;
    } else if (sourceJob.activeGeneration?.runId === run.runId && !CREATOR_ACTIVE_GENERATION_STATUSES.has(run.status)) {
        patch.activeGeneration = null;
        if (sourceJob.status === 'running') patch.status = sourceJob.complete ? 'complete' : 'draft';
    }

    return updateLoredeckCreatorProject(id, patch, { ...options, syncLocal: true });
}

export function updateLoredeckCreatorGenerationUnit(jobId = '', unitId = '', unitPatch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };
    if (!unitPatch || typeof unitPatch !== 'object' || Array.isArray(unitPatch)) {
        return { ok: false, error: 'Creator generation unit update must be an object.' };
    }
    const registry = getLoredeckCreatorRegistry(getState());
    const sourceJob = registry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Creator project was not found.' };
    const resolvedUnitId = normalizeLoredeckCreatorId(unitId || unitPatch.unitId || unitPatch.id || sourceJob.activeGeneration?.unitId || '', '');
    if (!resolvedUnitId) return { ok: false, error: 'Missing Creator generation unit id.' };
    const incomingRunId = normalizeLoredeckCreatorId(unitPatch.runId || '', '');
    if (
        sourceJob.activeGeneration?.unitId === resolvedUnitId
        && sourceJob.activeGeneration?.runId
        && incomingRunId
        && sourceJob.activeGeneration.runId !== incomingRunId
        && options.allowStale !== true
    ) {
        return {
            ok: true,
            ignored: true,
            reason: 'stale_creator_generation_unit',
            job: sourceJob,
            registry,
        };
    }

    const generationUnits = {
        ...(sourceJob.generationUnits || {}),
    };
    const previous = generationUnits[resolvedUnitId] || {};
    const unit = normalizeLoredeckCreatorGenerationUnit({
        ...previous,
        ...unitPatch,
        unitId: resolvedUnitId,
        jobId: id,
        updatedAt: Number.isFinite(Number(unitPatch.updatedAt)) ? Number(unitPatch.updatedAt) : Date.now(),
    }, Object.keys(generationUnits).length);
    if (!unit) return { ok: false, error: 'Creator generation unit could not be normalized.' };
    generationUnits[unit.unitId] = unit;

    const patch = { generationUnits };
    if (CREATOR_ACTIVE_GENERATION_STATUSES.has(unit.status) && options.activate !== false) {
        const currentStage = options.currentStage || sourceJob.activeGeneration?.currentStage || sourceJob.currentStage || unit.stage || '';
        patch.activeGeneration = {
            ...(sourceJob.activeGeneration || {}),
            id: sourceJob.activeGeneration?.id || unit.runId || unit.unitId,
            jobId: id,
            runId: unit.runId || sourceJob.activeGeneration?.runId || '',
            unitId: unit.unitId,
            stage: unit.stage || sourceJob.activeGeneration?.stage || '',
            currentStage,
            status: 'running',
            phase: unit.status,
            label: options.label || unit.label || sourceJob.activeGeneration?.label || 'Generation running',
            startedAt: unit.startedAt || sourceJob.activeGeneration?.startedAt || Date.now(),
            updatedAt: unit.updatedAt || Date.now(),
        };
        patch.status = 'running';
        if (currentStage) patch.currentStage = currentStage;
    } else if (
        sourceJob.activeGeneration?.unitId === unit.unitId
        && (
            !sourceJob.activeGeneration?.runId
            || !unit.runId
            || sourceJob.activeGeneration.runId === unit.runId
        )
        && !CREATOR_ACTIVE_GENERATION_STATUSES.has(unit.status)
    ) {
        patch.activeGeneration = null;
        if (sourceJob.status === 'running') patch.status = sourceJob.complete ? 'complete' : 'draft';
    }

    return updateLoredeckCreatorProject(id, patch, { ...options, syncLocal: true });
}

export function clearLoredeckCreatorJob(jobId = '', options = {}) {
    const state = getState();
    const registry = getLoredeckCreatorRegistry(state);
    const id = normalizeLoredeckCreatorString(jobId || registry.activeJobId, 160);
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    if (id && projectRegistry.jobs[id]) delete projectRegistry.jobs[id];
    if (projectRegistry.activeJobId === id) projectRegistry.activeJobId = '';
    if (projectRegistry.lastJobId === id) projectRegistry.lastJobId = '';
    const nextGlobalActive = getMostRecentLoredeckCreatorJob(projectRegistry);
    if (nextGlobalActive) {
        projectRegistry.activeJobId = nextGlobalActive.jobId;
        projectRegistry.lastJobId = nextGlobalActive.jobId;
    }
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
    saveSettings(settings);

    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    if (id && localRegistry.jobs[id]) delete localRegistry.jobs[id];
    if (localRegistry.activeJobId === id) localRegistry.activeJobId = '';
    if (localRegistry.lastJobId === id) localRegistry.lastJobId = '';
    const nextLocalActive = getMostRecentLoredeckCreatorJob(localRegistry);
    if (nextLocalActive) {
        localRegistry.activeJobId = nextLocalActive.jobId;
        localRegistry.lastJobId = nextLocalActive.jobId;
    }
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
    return {
        ok: true,
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: settings.loredeckCreatorProjects,
    };
}

export function getLoredeckLibraryRegistry(state = null) {
    const settings = getSettings();
    const globalLibrary = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const chatRegistry = normalizeLoredeckRegistry(
        state?.loredeckRegistry,
        { schemaVersion: 1, packs: {} }
    );
    return normalizeLoredeckRegistry({
        schemaVersion: 1,
        packs: {
            ...(chatRegistry.packs || {}),
            ...(globalLibrary.packs || {}),
        },
        folders: globalLibrary.folders || [],
        deckPlacements: globalLibrary.deckPlacements || [],
        activeStack: globalLibrary.activeStack || [],
    }, DEFAULT_SETTINGS.loredeckLibrary);
}

export function upsertLoredeckLibraryPack(packRecord = {}) {
    const clearableOptionalFields = [
        'pendingChanges',
        'tagRegistry',
        'timelineRegistry',
        'healthIssueStates',
        'manifestData',
        'assets',
        'library',
        'derivedFrom',
    ];
    const explicitOptionalFields = new Set(clearableOptionalFields.filter(key => Object.prototype.hasOwnProperty.call(packRecord || {}, key)));
    const normalized = normalizeLoredeckRegistry(
        { schemaVersion: 1, packs: { [packRecord.packId || packRecord.id || '']: packRecord } },
        { schemaVersion: 1, packs: {} }
    );
    const [packId, pack] = Object.entries(normalized.packs || {})[0] || [];
    if (!packId || !pack) {
        return { ok: false, error: 'Loredeck record must include a packId/id.' };
    }
    const bundledDefault = DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId];
    if (bundledDefault?.type === 'bundled' && pack.type !== 'bundled') {
        return { ok: false, error: 'A Custom or Generated Loredeck cannot replace a Bundled Loredeck with the same id.' };
    }

    const settings = getSettings();
    const library = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const existing = library.packs[packId] || {};
    const nextPack = {
        ...existing,
        ...pack,
        installedAt: existing.installedAt || pack.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    for (const key of explicitOptionalFields) {
        if (!Object.prototype.hasOwnProperty.call(pack, key)) delete nextPack[key];
    }
    library.packs[packId] = nextPack;
    settings.loredeckLibrary = normalizeLoredeckRegistry(library, DEFAULT_SETTINGS.loredeckLibrary);
    saveSettings(settings);
    return { ok: true, pack: settings.loredeckLibrary.packs[packId], library: settings.loredeckLibrary };
}

export function removeLoredeckLibraryPack(packId, options = {}) {
    const id = String(packId || '').trim();
    if (!id) return { ok: false, error: 'Missing Loredeck id.' };
    if (options.allowBundled !== true && DEFAULT_SETTINGS.loredeckLibrary?.packs?.[id]?.type === 'bundled') {
        return { ok: false, error: 'Bundled Loredecks cannot be removed from the library.' };
    }

    const state = getState();
    const settings = getSettings();
    const library = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const chatRegistry = normalizeLoredeckRegistry(state?.loredeckRegistry, { schemaVersion: 1, packs: {} });
    let settingsChanged = false;
    let stateChanged = false;
    let removed = false;
    if (library.packs[id]) {
        delete library.packs[id];
        settingsChanged = true;
        removed = true;
    }

    if (chatRegistry.packs[id]) {
        delete chatRegistry.packs[id];
        state.loredeckRegistry = normalizeLoredeckRegistry(chatRegistry, { schemaVersion: 1, packs: {} });
        stateChanged = true;
        removed = true;
    }

    const projectRegistryResult = options.clearCreatorProjects === false
        ? { registry: getLoredeckCreatorSettingsRegistry(settings), removedJobIds: [] }
        : removeLoredeckCreatorJobsForGeneratedPackId(settings.loredeckCreatorProjects, id);
    const localRegistryResult = options.clearCreatorProjects === false
        ? { registry: normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator), removedJobIds: [] }
        : removeLoredeckCreatorJobsForGeneratedPackId(state.loredeckCreator || getDefaultState().loredeckCreator, id);
    const clearedCreatorJobIds = [
        ...new Set([
            ...(projectRegistryResult.removedJobIds || []),
            ...(localRegistryResult.removedJobIds || []),
        ]),
    ];
    if (projectRegistryResult.removedJobIds.length) {
        settings.loredeckCreatorProjects = projectRegistryResult.registry;
        settingsChanged = true;
    }
    if (localRegistryResult.removedJobIds.length) {
        state.loredeckCreator = localRegistryResult.registry;
        stateChanged = true;
    }

    if (!removed && !clearedCreatorJobIds.length) {
        return { ok: false, error: 'Loredeck is not registered.' };
    }
    if (settingsChanged) {
        settings.loredeckLibrary = normalizeLoredeckRegistry(library, DEFAULT_SETTINGS.loredeckLibrary);
        saveSettings(settings);
    }
    if (stateChanged) {
        saveState(state, { syncPrompt: false, sanitize: true });
    }
    return { ok: true, library: settings.loredeckLibrary, clearedCreatorJobIds };
}

export function importLoredeckLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeLoredeckRegistry(registry, { schemaVersion: 1, packs: {} });
    const settings = getSettings();
    const current = options.replace === true
        ? normalizeLoredeckRegistry(DEFAULT_SETTINGS.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary)
        : normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);

    let importedCount = 0;
    let skippedCount = 0;
    for (const [packId, pack] of Object.entries(incoming.packs || {})) {
        const bundledDefault = DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId];
        if (bundledDefault?.type === 'bundled' && pack.type !== 'bundled') {
            skippedCount += 1;
            continue;
        }
        current.packs[packId] = {
            ...(current.packs[packId] || {}),
            ...pack,
            installedAt: current.packs[packId]?.installedAt || pack.installedAt || Date.now(),
            updatedAt: Date.now(),
        };
        importedCount += 1;
    }
    current.folders = [
        ...(current.folders || []),
        ...(incoming.folders || []),
    ];
    current.deckPlacements = [
        ...(current.deckPlacements || []),
        ...(incoming.deckPlacements || []),
    ];
    current.activeStack = (incoming.activeStack || []).length
        ? incoming.activeStack
        : (current.activeStack || []);

    settings.loredeckLibrary = normalizeLoredeckRegistry(current, DEFAULT_SETTINGS.loredeckLibrary);
    saveSettings(settings);
    return { ok: true, importedCount, skippedCount, library: settings.loredeckLibrary };
}

function promoteChatLoredeckRegistryToSettings(state = {}) {
    const chatRegistry = normalizeLoredeckRegistry(
        state?.loredeckRegistry,
        { schemaVersion: 1, packs: {} }
    );
    const chatPacks = chatRegistry.packs || {};
    if (!Object.keys(chatPacks).length) return;

    const settings = getSettings();
    const globalLibrary = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    let changed = false;
    for (const [packId, pack] of Object.entries(chatPacks)) {
        if (!globalLibrary.packs[packId]) {
            globalLibrary.packs[packId] = pack;
            changed = true;
        }
    }
    if (!changed) return;
    settings.loredeckLibrary = globalLibrary;
    saveSettings(settings);
}

function promoteChatLoredeckCreatorToSettings(state = {}) {
    const chatRegistry = normalizeLoredeckCreatorRegistry(state?.loredeckCreator || getDefaultState().loredeckCreator);
    if (!Object.keys(chatRegistry.jobs || {}).length) return;

    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    let changed = false;
    for (const [jobId, job] of Object.entries(chatRegistry.jobs || {})) {
        const existing = projectRegistry.jobs[jobId];
        if (!existing || (Number(job.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
            projectRegistry.jobs[jobId] = job;
            changed = true;
        }
    }
    if (chatRegistry.activeJobId && projectRegistry.jobs[chatRegistry.activeJobId]
        && projectRegistry.activeJobId !== chatRegistry.activeJobId) {
        projectRegistry.activeJobId = chatRegistry.activeJobId;
        changed = true;
    }
    if (chatRegistry.lastJobId && projectRegistry.jobs[chatRegistry.lastJobId]
        && projectRegistry.lastJobId !== chatRegistry.lastJobId) {
        projectRegistry.lastJobId = chatRegistry.lastJobId;
        changed = true;
    }
    if (!changed) return;
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
    saveSettings(settings);
}



function migrateBucket(container, bucketName = 'storage') {
    if (!container || typeof container !== 'object') return null;
    const current = container[MODULE_KEY];
    if (current && typeof current === 'object') return current;
    for (const legacyKey of LEGACY_MODULE_KEYS || []) {
        const legacy = container[legacyKey];
        if (legacy && typeof legacy === 'object') {
            container[MODULE_KEY] = legacy;
            return legacy;
        }
    }
    container[MODULE_KEY] = {};
    return container[MODULE_KEY];
}

function removeLegacyBuckets(container) {
    if (!container || typeof container !== 'object') return;
    for (const legacyKey of LEGACY_MODULE_KEYS || []) {
        if (legacyKey !== MODULE_KEY && Object.prototype.hasOwnProperty.call(container, legacyKey)) {
            delete container[legacyKey];
        }
    }
}

// ── Settings I/O ────────────────────────────────────────────────────────────────

function normalizeAutomationModeValue(value, fallback = 'manual') {
    return AUTOMATION_MODE_VALUES.includes(value) ? value : fallback;
}

function normalizeExperienceModeValue(value, fallback = 'basic') {
    return EXPERIENCE_MODE_VALUES.includes(value) ? value : fallback;
}

function hasStoredSagaSettings(stored = {}) {
    return !!(stored && typeof stored === 'object' && Object.keys(stored).length > 0);
}

function applyBasicExperienceProfile(settings) {
    Object.assign(settings, BASIC_EXPERIENCE_SETTINGS);
    settings.experienceMode = 'basic';
    settings.basicExperienceProfileVersion = BASIC_EXPERIENCE_PROFILE_VERSION;
    return settings;
}

/**
 * Reads extensionSettings.saga, deep-merges defaults for any
 * missing keys, and returns the live settings object. Always reacquires from
 * SillyTavern.getContext().
 * @returns {Object} SagaSettings
 */
export function getSettings() {
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.extensionSettings) {
        return { ...DEFAULT_SETTINGS };
    }
    const { extensionSettings } = ctx;
    const stored = migrateBucket(extensionSettings, 'extensionSettings') || {};
    // Merge defaults into stored, preserving existing user values. Nested setting
    // registries currently only need a one-level merge.
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    merged.collapsedSections = {
        ...(DEFAULT_SETTINGS.collapsedSections || {}),
        ...(stored.collapsedSections || {}),
    };
    merged.continuitySectionPrompts = {
        ...(DEFAULT_SETTINGS.continuitySectionPrompts || {}),
        ...(stored.continuitySectionPrompts || {}),
    };
    merged.loredeckLibrary = normalizeLoredeckRegistry(
        stored.loredeckLibrary || DEFAULT_SETTINGS.loredeckLibrary,
        DEFAULT_SETTINGS.loredeckLibrary
    );
    merged.themePackLibrary = normalizeThemePackRegistry(
        stored.themePackLibrary || DEFAULT_SETTINGS.themePackLibrary,
        DEFAULT_SETTINGS.themePackLibrary
    );
    merged.themeIconSetLibrary = normalizeThemeIconSetRegistry(
        stored.themeIconSetLibrary || DEFAULT_SETTINGS.themeIconSetLibrary,
        DEFAULT_SETTINGS.themeIconSetLibrary
    );
    merged.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(
        stored.loredeckCreatorProjects || DEFAULT_SETTINGS.loredeckCreatorProjects
    );

    const hasStoredSettings = hasStoredSagaSettings(stored);
    const legacyAutomationMode = normalizeAutomationModeValue(stored.workflowMode, '');
    merged.automationMode = normalizeAutomationModeValue(stored.automationMode, legacyAutomationMode || DEFAULT_SETTINGS.automationMode || 'manual');
    merged.workflowMode = merged.automationMode;
    merged.contextDetectionMode = normalizeAutomationModeValue(merged.contextDetectionMode, DEFAULT_SETTINGS.contextDetectionMode || 'manual');
    merged.contextDetectionAutoInterval = Math.max(1, Math.min(100, Number(merged.contextDetectionAutoInterval) || DEFAULT_SETTINGS.contextDetectionAutoInterval || 20));
    merged.contextDetectionAutoMinTurns = Math.max(1, Math.min(100, Number(merged.contextDetectionAutoMinTurns) || DEFAULT_SETTINGS.contextDetectionAutoMinTurns || 8));
    if (merged.contextDetectionAutoMinTurns > merged.contextDetectionAutoInterval) {
        merged.contextDetectionAutoMinTurns = merged.contextDetectionAutoInterval;
    }
    merged.contextDetectionAutoCharacterThreshold = Math.max(0, Math.min(50000, Number(merged.contextDetectionAutoCharacterThreshold) || DEFAULT_SETTINGS.contextDetectionAutoCharacterThreshold || 8000));
    merged.contextModelFallbackMinCharacters = Math.max(0, Math.min(20000, Number(merged.contextModelFallbackMinCharacters) || DEFAULT_SETTINGS.contextModelFallbackMinCharacters || 1200));
    merged.contextReasonerFallbackEnabled = merged.contextReasonerFallbackEnabled !== false;
    merged.contextLocalApplyMinConfidence = Math.max(0, Math.min(1, Number(merged.contextLocalApplyMinConfidence) || DEFAULT_SETTINGS.contextLocalApplyMinConfidence || 0.78));
    merged.contextReasonerProposalMinConfidence = Math.max(0, Math.min(1, Number(merged.contextReasonerProposalMinConfidence) || DEFAULT_SETTINGS.contextReasonerProposalMinConfidence || 0.55));
    if (stored.experienceMode === undefined && hasStoredSettings) {
        merged.experienceMode = 'advanced';
    } else {
        merged.experienceMode = normalizeExperienceModeValue(merged.experienceMode, DEFAULT_SETTINGS.experienceMode || 'basic');
    }
    if (merged.experienceMode === 'basic'
        && Number(stored.basicExperienceProfileVersion || 0) < BASIC_EXPERIENCE_PROFILE_VERSION) {
        applyBasicExperienceProfile(merged);
    }

    if (stored.hpSplitLoredeckDefaultsMigrated20260605 !== true) {
        merged.loredeckLibrary = normalizeLoredeckRegistry(
            migrateLegacyHpLoredeckRegistry(merged.loredeckLibrary),
            DEFAULT_SETTINGS.loredeckLibrary
        );
        merged.hpSplitLoredeckDefaultsMigrated20260605 = true;
    }

    if (stored.emptyLoredeckStackDefaultsMigrated20260605 !== true) {
        merged.loredeckLibrary = normalizeLoredeckRegistry({
            ...(merged.loredeckLibrary || {}),
            activeStack: clearDefaultHpLoredeckFolderStack(merged.loredeckLibrary?.activeStack),
        }, DEFAULT_SETTINGS.loredeckLibrary);
        merged.emptyLoredeckStackDefaultsMigrated20260605 = true;
    }

    if (stored.contextAutomationDefaultsMigrated20260606 !== true) {
        if (stored.contextDetectionAutoInterval === undefined || Number(stored.contextDetectionAutoInterval) === 5) {
            merged.contextDetectionAutoInterval = 20;
        }
        if (stored.contextDetectionAutoMinTurns === undefined) {
            merged.contextDetectionAutoMinTurns = 8;
        }
        if (stored.contextDetectionAutoCharacterThreshold === undefined) {
            merged.contextDetectionAutoCharacterThreshold = 8000;
        }
        if (stored.contextReasonerFallbackEnabled === undefined) {
            merged.contextReasonerFallbackEnabled = true;
        }
        if (stored.contextLocalApplyMinConfidence === undefined) {
            merged.contextLocalApplyMinConfidence = 0.78;
        }
        if (stored.contextReasonerProposalMinConfidence === undefined) {
            merged.contextReasonerProposalMinConfidence = 0.55;
        }
        merged.contextAutomationDefaultsMigrated20260606 = true;
    }

    if (stored.canonLoreAutoProposeDefaultsMigrated20260608 !== true) {
        if (stored.canonLoreAutoPropose === undefined || stored.canonLoreAutoPropose === true) {
            merged.canonLoreAutoPropose = false;
        }
        merged.canonLoreAutoProposeDefaultsMigrated20260608 = true;
    }

    // One-time upgrade from the old conservative story-lore generation defaults.
    // Previous builds wrote defaults into user settings, so simply changing
    // DEFAULT_SETTINGS would not affect existing installs that still hold the old
    // 10-message / 2048-token values.
    if (stored.loreBootstrapDefaultsMigrated20260531 !== true) {
        if (stored.loreSourceMessageCount === undefined || Number(stored.loreSourceMessageCount) === 10) {
            merged.loreSourceMessageCount = 40;
        }
        if (stored.loreMaxTokens === undefined || Number(stored.loreMaxTokens) === 2048) {
            merged.loreMaxTokens = 8192;
        }
        merged.loreBootstrapDefaultsMigrated20260531 = true;
    }

    // One-time migration for stricter, less expensive story-lore automation.
    // Older defaults treated generated lore like lightweight continuity and ran
    // too often for roleplay sessions with short turns.
    if (stored.loreAutomationDefaultsMigrated20260602 !== true) {
        if (stored.loreGenerationAutoInterval === undefined || Number(stored.loreGenerationAutoInterval) === 10) {
            merged.loreGenerationAutoInterval = 50;
        }
        if (stored.loreGenerationAutoMinTurns === undefined) {
            merged.loreGenerationAutoMinTurns = 20;
        }
        if (stored.loreGenerationAutoWordThreshold === undefined) {
            merged.loreGenerationAutoWordThreshold = 2500;
        }
        if (stored.loreBulkFactsPerChunk === undefined || Number(stored.loreBulkFactsPerChunk) === 14) {
            merged.loreBulkFactsPerChunk = 8;
        }
        if (stored.loreIncrementalTargetEntries === undefined || Number(stored.loreIncrementalTargetEntries) === 8) {
            merged.loreIncrementalTargetEntries = 5;
        }
        if (stored.loreSimilarityRouting === undefined) {
            merged.loreSimilarityRouting = true;
        }
        if (stored.loreStrictQualityGate === undefined) {
            merged.loreStrictQualityGate = true;
        }
        merged.loreAutomationDefaultsMigrated20260602 = true;
    }

    // One-time prompt-depth default migration for the relevance-tiered injection UI.
    // Preserve user-customized values; only move old defaults one layer closer.
    if (stored.relevancePromptDepthDefaultsMigrated20260602 !== true) {
        const migrateDepth = (key, oldValue, newValue) => {
            if (stored[key] === undefined || Number(stored[key]) === oldValue) merged[key] = newValue;
        };
        migrateDepth('continuityInjectionDepth', 4, 3);
        migrateDepth('loreInjectionDepth', 4, 3);
        migrateDepth('loreHighInjectionDepth', 3, 2);
        migrateDepth('loreNormalInjectionDepth', 6, 5);
        migrateDepth('loreLowInjectionDepth', 10, 9);
        merged.relevancePromptDepthDefaultsMigrated20260602 = true;
    }

    if (merged.autoRelevanceMode === 'off') {
        merged.autoRelevanceEnabled = false;
        merged.autoRelevanceMode = 'suggest';
    }

    // One-time compression-level default migration. Preserve user-customized values;
    // only move old defaults from earlier tier profiles to the new uniform level 3.
    if (stored.compressionLevelDefaultsMigrated20260602 !== true) {
        const migrateLevel = (key, oldValues, newValue = 3) => {
            const current = stored[key];
            if (current === undefined || oldValues.includes(Number(current))) merged[key] = newValue;
        };
        migrateLevel('continuityCompressionLevel', [2]);
        migrateLevel('loreCompressionLevel', [2]);
        migrateLevel('loreHighCompressionLevel', [1]);
        migrateLevel('loreNormalCompressionLevel', [2]);
        migrateLevel('loreLowCompressionLevel', [4]);
        merged.compressionLevelDefaultsMigrated20260602 = true;
    }

    // One-time API/model settings migration. Provider generation parameters are
    // now shown per provider, with matching defaults. Retire fragile OpenAI
    // JSON/proxy toggles from old saved settings so they cannot keep breaking
    // connection tests after the UI no longer exposes them.
    if (stored.providerParameterDefaultsMigrated20260602 !== true) {
        if (stored.continuityTemperature === undefined) merged.continuityTemperature = 0.7;
        if (stored.continuityTopP === undefined) merged.continuityTopP = 0.98;
        if (stored.continuityMaxTokens === undefined || Number(stored.continuityMaxTokens) === 4096) {
            merged.continuityMaxTokens = 8192;
        }
        if (stored.loreTemperature === undefined) merged.loreTemperature = 0.7;
        if (stored.loreTopP === undefined) merged.loreTopP = 0.98;
        if (stored.loreMaxTokens === undefined || Number(stored.loreMaxTokens) === 2048) {
            merged.loreMaxTokens = 8192;
        }
        merged.continuityOpenAIUseJsonMode = false;
        merged.continuityOpenAIUseSTProxy = false;
        merged.loreOpenAIUseJsonMode = false;
        merged.loreOpenAIUseSTProxy = false;
        merged.providerParameterDefaultsMigrated20260602 = true;
    }

    // One-time continuity performance migration. Earlier defaults used a
    // single-call scan for routine recent windows, which looked frozen on slow
    // JSON models. Preserve explicit user changes and move only old defaults.
    if (stored.continuityPerformanceDefaultsMigrated20260603 !== true) {
        if (stored.continuityAutoInterval === undefined || Number(stored.continuityAutoInterval) === 5) {
            merged.continuityAutoInterval = 10;
        }
        if (stored.continuityScanFastThreshold === undefined || Number(stored.continuityScanFastThreshold) === 20) {
            merged.continuityScanFastThreshold = 4;
        }
        merged.continuityPerformanceDefaultsMigrated20260603 = true;
    }

    // Write back merged defaults so the object is complete going forward
    extensionSettings[MODULE_KEY] = merged;
    removeLegacyBuckets(extensionSettings);
    return merged;
}

/**
 * Writes settings to extensionSettings.saga and persists
 * via saveSettingsDebounced().
 * @param {Object} settings - SagaSettings to save
 */
export function saveSettings(settings) {
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.extensionSettings) return;
    const { extensionSettings, saveSettingsDebounced } = ctx;
    if (settings && typeof settings === 'object') {
        settings.loredeckLibrary = normalizeLoredeckRegistry(
            migrateLegacyHpLoredeckRegistry(settings.loredeckLibrary),
            DEFAULT_SETTINGS.loredeckLibrary
        );
        settings.themePackLibrary = normalizeThemePackRegistry(settings.themePackLibrary, DEFAULT_SETTINGS.themePackLibrary);
        settings.themeIconSetLibrary = normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, DEFAULT_SETTINGS.themeIconSetLibrary);
        settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(settings.loredeckCreatorProjects || DEFAULT_SETTINGS.loredeckCreatorProjects);
    }
    extensionSettings[MODULE_KEY] = settings;
    removeLegacyBuckets(extensionSettings);
    if (typeof saveSettingsDebounced === 'function') {
        saveSettingsDebounced();
    }
    queuePromptInjectionSync();
}


function queuePromptInjectionSync() {
    try {
        const syncPromptInjection = typeof globalThis.sagaSyncPromptInjection === 'function'
            ? globalThis.sagaSyncPromptInjection
            : globalThis.sagaSyncPromptInjection;
        if (typeof syncPromptInjection === 'function') {
            queueMicrotask(() => {
                try {
                    syncPromptInjection();
                } catch (e) {
                    console.warn(`${LOG_PREFIX} Failed to sync prompt injection after state/settings save`, e);
                }
            });
        }
    } catch (_) {
        // Never let prompt-sync bookkeeping break persistence.
    }
}

// ── State I/O ───────────────────────────────────────────────────────────────────

/**
 * Reads chatMetadata.saga, migrates if needed, merges with
 * defaults, and returns the live state object. Always reacquires from
 * SillyTavern.getContext().
 * @returns {Object} SagaState
 */
export function getState() {
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.chatMetadata) {
        console.warn(`${LOG_PREFIX} chatMetadata not available, returning default state`);
        return getDefaultState();
    }
    const { chatMetadata } = ctx;
    let state = migrateBucket(chatMetadata, 'chatMetadata');
    if (!state || typeof state !== 'object' || Object.keys(state).length === 0) {
        state = getDefaultState();
        chatMetadata[MODULE_KEY] = state;
        removeLegacyBuckets(chatMetadata);
        migratedStateRefs.add(state);
        return state;
    }

    // Fast path: once a state object has been migrated/sanitized in this browser
    // session, do not repeat full migration/normalization on every UI click.
    // saveState() still sanitizes before persistence, and a new chat/state object
    // naturally misses this WeakSet and gets migrated once.
    if (migratedStateRefs.has(state)) {
        return state;
    }

    // Always run migration on first read. If migration/compaction shrinks an oversized
    // Saga block, persist immediately so a poisoned chat does not keep
    // rehydrating the same megabyte-scale pending lore payload.
    const beforeSize = safeJsonSize(state);
    state = migrateState(state);
    state = sanitizeLoreArraysForStorage(state);
    if (state.lastDelta === undefined) state.lastDelta = null;
    stripRetiredStateHistoryFields(state);
    chatMetadata[MODULE_KEY] = state;
    removeLegacyBuckets(chatMetadata);

    const afterSize = safeJsonSize(state);
    if (typeof ctx.saveMetadata === 'function' && beforeSize > 0 && (afterSize < beforeSize || beforeSize > MAX_CHAT_STATE_BYTES_BEFORE_AUTO_PERSIST)) {
        try {
            ctx.saveMetadata();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to persist compacted Saga state on read`, e);
        }
    }

    migratedStateRefs.add(state);
    return state;
}

/**
 * Writes state to chatMetadata.saga and persists via saveMetadata().
 * @param {Object} state - SagaState to save
 */
export function saveState(state, options = {}) {
    const { syncPrompt = true, sanitize = true } = options || {};
    const ctx = SillyTavern.getContext();
    if (!ctx || !ctx.chatMetadata) {
        console.warn(`${LOG_PREFIX} chatMetadata not available, cannot save state`);
        return;
    }
    const { chatMetadata, saveMetadata } = ctx;
    if (!state._version) {
        state._version = SCHEMA_VERSION;
    }
    if (sanitize !== false) {
        state = sanitizeLoreArraysForStorage(state);
    }
    stripRetiredStateHistoryFields(state);
    chatMetadata[MODULE_KEY] = state;
    removeLegacyBuckets(chatMetadata);
    migratedStateRefs.add(state);
    if (typeof saveMetadata === 'function') {
        saveMetadata();
    }
    if (syncPrompt !== false) {
        queuePromptInjectionSync();
    }
}

// ── Storage safety / recovery helpers ─────────────────────────────────────────

export const MAX_PENDING_LORE_ENTRIES = 300;
const MAX_ACCEPTED_LORE_ENTRIES_FOR_AUTOSANITIZE = 0; // 0 = uncapped; never drop accepted lore during storage sanitization


function safeJsonSize(value) {
    try {
        return JSON.stringify(value || {}).length;
    } catch (_e) {
        return 0;
    }
}

const RETIRED_STORAGE_KEYS = ['memo' + 'History', 'state' + 'History'];

function stripRetiredStateHistoryFields(state = {}) {
    if (state && typeof state === 'object') {
        for (const key of RETIRED_STORAGE_KEYS) delete state[key];
    }
    return state;
}

function prePruneStringArray(values, limit = 32, textLimit = 160) {
    const rawValues = Array.isArray(values) ? values : [];
    const seen = new Set();
    const out = [];

    for (const raw of rawValues) {
        const text = truncateText(raw, textLimit).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }

    return out;
}

function prePruneLoreEntryForNormalization(entry) {
    if (!entry || typeof entry !== 'object') return entry;

    const pruned = { ...entry };

    if (entry.scope && typeof entry.scope === 'object' && !Array.isArray(entry.scope)) {
        pruned.scope = {
            ...entry.scope,
            characters: prePruneStringArray(entry.scope.characters, 16, 100),
            locations: prePruneStringArray(entry.scope.locations, 12, 100),
            factions: prePruneStringArray(entry.scope.factions, 12, 100),
            topics: prePruneStringArray(entry.scope.topics, 18, 100),
            objects: prePruneStringArray(entry.scope.objects, 12, 100),
            spells: prePruneStringArray(entry.scope.spells, 12, 100),
            schoolYears: prePruneStringArray(entry.scope.schoolYears, 8, 32),
            books: prePruneStringArray(entry.scope.books, 8, 100),
            eras: prePruneStringArray(entry.scope.eras, 8, 100),
        };
    }

    // ActiveWhen is derived/legacy compatibility only. Never preserve massive
    // activeWhen arrays in storage; they can be reconstructed for activation from
    // scope at runtime.
    if (entry.activeWhen && typeof entry.activeWhen === 'object' && !Array.isArray(entry.activeWhen)) {
        pruned.activeWhen = {
            erasAny: prePruneStringArray(entry.activeWhen.erasAny, 8, 100),
            locationsAny: prePruneStringArray(entry.activeWhen.locationsAny, 8, 100),
            charactersPresentAny: prePruneStringArray(entry.activeWhen.charactersPresentAny, 12, 100),
            tagsAny: prePruneStringArray(entry.activeWhen.tagsAny, 12, 100),
        };
    }

    if (entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content)) {
        pruned.content = {
            ...entry.content,
            fact: truncateText(entry.content.fact, 1200),
            injection: truncateText(entry.content.injection, 1200),
            constraints: prePruneStringArray(entry.content.constraints, 8, 260),
            antiLore: prePruneStringArray(entry.content.antiLore, 8, 260),
            notes: truncateText(entry.content.notes, 400),
        };
    }

    pruned.tags = prePruneStringArray(entry.tags, 10, 40);
    const generation = entry.extensions?.sagaGeneration;
    const sagaLoredeck = entry.extensions?.sagaLoredeck;
    const sagaContextGate = entry.extensions?.sagaContextGate;
    const relevanceMigration = entry.extensions?.relevanceMigration;
    const autoRelevance = entry.extensions?.autoRelevance;
    const pendingReview = entry.extensions?.sagaPendingReview;
    const extensions = {};
    if (generation && typeof generation === 'object') {
        extensions.sagaGeneration = {
            mode: truncateText(generation.mode, 40),
            batchId: truncateText(generation.batchId, 120),
            chunkId: truncateText(generation.chunkId, 180),
            startIndex: Number.isFinite(Number(generation.startIndex)) ? Number(generation.startIndex) : 0,
            endIndex: Number.isFinite(Number(generation.endIndex)) ? Number(generation.endIndex) : 0,
            messageHash: truncateText(generation.messageHash, 32),
            evidenceMessageRefs: prePruneStringArray(generation.evidenceMessageRefs, 20, 32),
            operation: truncateText(generation.operation, 24),
            targetEntryId: truncateText(generation.targetEntryId, 140),
            qualityRoute: truncateText(generation.qualityRoute, 40),
            qualityReason: truncateText(generation.qualityReason, 240),
            similarityRoute: truncateText(generation.similarityRoute, 40),
            similarityReason: truncateText(generation.similarityReason, 240),
            durabilityReason: truncateText(generation.durabilityReason, 240),
            recommendedPin: !!generation.recommendedPin,
            recommendedMute: !!generation.recommendedMute,
            acceptedAsOperation: truncateText(generation.acceptedAsOperation, 24),
            acceptedTargetEntryId: truncateText(generation.acceptedTargetEntryId, 140),
            acceptedAt: Number.isFinite(Number(generation.acceptedAt)) ? Number(generation.acceptedAt) : 0,
            candidateCategory: truncateText(generation.candidateCategory, 60),
            generatedAt: Number.isFinite(Number(generation.generatedAt)) ? Number(generation.generatedAt) : 0,
            targetTotal: Number.isFinite(Number(generation.targetTotal)) ? Number(generation.targetTotal) : 0,
        };
    }
    if (sagaLoredeck && typeof sagaLoredeck === 'object') {
        const compact = compactSagaLoredeckExtension(sagaLoredeck);
        if (compact) extensions.sagaLoredeck = compact;
    }
    if (sagaContextGate && typeof sagaContextGate === 'object') {
        const compact = compactSagaContextGateExtension(sagaContextGate);
        if (compact) extensions.sagaContextGate = compact;
    }
    if (relevanceMigration && typeof relevanceMigration === 'object') extensions.relevanceMigration = {
        migratedAt: Number.isFinite(Number(relevanceMigration.migratedAt)) ? Number(relevanceMigration.migratedAt) : 0,
        previousLifecycleStatus: truncateText(relevanceMigration.previousLifecycleStatus, 40),
        localRelevanceScore: Number.isFinite(Number(relevanceMigration.localRelevanceScore)) ? Number(relevanceMigration.localRelevanceScore) : 0,
        temporalRole: truncateText(relevanceMigration.temporalRole, 40),
    };
    if (autoRelevance && typeof autoRelevance === 'object') extensions.autoRelevance = {
        mode: truncateText(autoRelevance.mode, 20),
        confidence: Number.isFinite(Number(autoRelevance.confidence)) ? Number(autoRelevance.confidence) : 0,
        reason: truncateText(autoRelevance.reason, 240),
        updatedAt: Number.isFinite(Number(autoRelevance.updatedAt)) ? Number(autoRelevance.updatedAt) : 0,
    };
    if (pendingReview && typeof pendingReview === 'object') extensions.sagaPendingReview = pendingReview;
    pruned.extensions = extensions;
    return pruned;
}

function truncateText(value, limit = 1000) {
    return String(value || '').slice(0, limit);
}

function compactStringArray(values, limit = 12, textLimit = 160) {
    const rawValues = Array.isArray(values) ? values : [];
    const seen = new Set();
    const out = [];

    for (const raw of rawValues) {
        const text = truncateText(raw, textLimit).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }

    return out;
}

function compactStringMapForStorage(value, limit = 16, textLimit = 120) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const [key, raw] of Object.entries(input).slice(0, limit)) {
        const cleanKey = truncateText(key, textLimit).trim();
        if (!cleanKey) continue;
        out[cleanKey] = truncateText(raw, textLimit).trim() || 'unknown';
    }
    return out;
}

function compactPlainObjectMapForStorage(value, limit = 16, textLimit = 120) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const out = {};
    for (const [key, raw] of Object.entries(input).slice(0, limit)) {
        const cleanKey = truncateText(key, textLimit).trim();
        if (!cleanKey || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        out[cleanKey] = {
            scope: truncateText(raw.scope, 60),
            sortKey: Number.isFinite(Number(raw.sortKey)) ? Number(raw.sortKey) : null,
            precision: truncateText(raw.precision, 80),
            label: truncateText(raw.label, 180),
        };
    }
    return out;
}


function compactSagaLoredeckExtension(sagaLoredeck = {}) {
    if (!sagaLoredeck || typeof sagaLoredeck !== 'object' || Array.isArray(sagaLoredeck)) return null;
    const compact = {
        packId: truncateText(sagaLoredeck.packId, 120),
        packType: truncateText(sagaLoredeck.packType, 40),
        packTitle: truncateText(sagaLoredeck.packTitle, 160),
        file: truncateText(sagaLoredeck.file, 240),
        stackPriority: Number.isFinite(Number(sagaLoredeck.stackPriority)) ? Number(sagaLoredeck.stackPriority) : 0,
        stackIndex: Number.isFinite(Number(sagaLoredeck.stackIndex)) ? Number(sagaLoredeck.stackIndex) : 0,
    };
    return Object.values(compact).some(value => value !== '' && value !== 0) ? compact : null;
}

function compactSagaContextGateExtension(gate = {}) {
    if (!gate || typeof gate !== 'object' || Array.isArray(gate)) return null;
    const compact = {
        status: truncateText(gate.status, 40),
        hasGate: gate.hasGate === true,
        eligible: gate.eligible === true,
        matchedBy: truncateText(gate.matchedBy, 60),
        reason: truncateText(gate.reason, 240),
        packId: truncateText(gate.packId, 120),
    };
    return Object.values(compact).some(value => value !== '' && value !== false) ? compact : null;
}

function hasCompactContextValue(contextGate = {}) {
    if (!contextGate || typeof contextGate !== 'object' || Array.isArray(contextGate)) return false;
    return Object.entries(contextGate).some(([key, value]) => {
        if (key === 'approximate') return value === true;
        if (value === null || value === undefined || value === '') return false;
        return Number.isFinite(Number(value)) || String(value || '').trim() !== '';
    });
}

function compactLoreContextForStorage(contextGate = {}) {
    if (!contextGate || typeof contextGate !== 'object' || Array.isArray(contextGate)) return null;
    const compact = {
        scope: truncateText(contextGate.scope, 60),
        anchorId: truncateText(contextGate.anchorId, 180),
        validFromAnchor: truncateText(contextGate.validFromAnchor, 180),
        validToAnchor: truncateText(contextGate.validToAnchor, 180),
        arc: truncateText(contextGate.arc, 180),
        arcId: truncateText(contextGate.arcId, 180),
        phase: truncateText(contextGate.phase, 180),
        phaseId: truncateText(contextGate.phaseId, 180),
        season: truncateText(contextGate.season, 80),
        episode: truncateText(contextGate.episode, 80),
        chapter: truncateText(contextGate.chapter, 80),
        issue: truncateText(contextGate.issue, 80),
        quest: truncateText(contextGate.quest, 180),
        gameStage: truncateText(contextGate.gameStage, 180),
        stardateFrom: truncateText(contextGate.stardateFrom, 80),
        stardateTo: truncateText(contextGate.stardateTo, 80),
        sortKeyFrom: Number.isFinite(Number(contextGate.sortKeyFrom)) ? Number(contextGate.sortKeyFrom) : null,
        sortKeyTo: Number.isFinite(Number(contextGate.sortKeyTo)) ? Number(contextGate.sortKeyTo) : null,
        precision: truncateText(contextGate.precision, 80),
        windowKind: truncateText(contextGate.windowKind, 80),
        label: truncateText(contextGate.label, 180),
        approximate: contextGate.approximate === true,
    };
    return hasCompactContextValue(compact) ? compact : null;
}

function compactLoreCoordinatesForStorage(coordinates = []) {
    return (Array.isArray(coordinates) ? coordinates : [])
        .map(coordinate => {
            if (!coordinate || typeof coordinate !== 'object' || Array.isArray(coordinate)) return null;
            const compact = {
                axis: truncateText(coordinate.axis, 120),
                id: truncateText(coordinate.id, 160),
                label: truncateText(coordinate.label, 180),
                from: truncateText(coordinate.from, 180),
                to: truncateText(coordinate.to, 180),
                sortKeyFrom: Number.isFinite(Number(coordinate.sortKeyFrom)) ? Number(coordinate.sortKeyFrom) : null,
                sortKeyTo: Number.isFinite(Number(coordinate.sortKeyTo)) ? Number(coordinate.sortKeyTo) : null,
                confidence: Number.isFinite(Number(coordinate.confidence)) ? Math.max(0, Math.min(1, Number(coordinate.confidence))) : 1,
                required: coordinate.required !== false,
            };
            return hasCompactContextValue(compact) ? compact : null;
        })
        .filter(Boolean)
        .slice(0, 24);
}

function compactLoreExtensionsForStorage(normalized) {
    const out = {};
    const generation = normalized?.extensions?.sagaGeneration;
    if (generation && typeof generation === 'object') {
        out.sagaGeneration = {
            mode: truncateText(generation.mode, 40),
            batchId: truncateText(generation.batchId, 120),
            chunkId: truncateText(generation.chunkId, 180),
            startIndex: Number.isFinite(Number(generation.startIndex)) ? Number(generation.startIndex) : 0,
            endIndex: Number.isFinite(Number(generation.endIndex)) ? Number(generation.endIndex) : 0,
            messageHash: truncateText(generation.messageHash, 32),
            evidenceMessageRefs: compactStringArray(generation.evidenceMessageRefs, 20, 32),
            operation: truncateText(generation.operation, 24),
            targetEntryId: truncateText(generation.targetEntryId, 140),
            qualityRoute: truncateText(generation.qualityRoute, 40),
            qualityReason: truncateText(generation.qualityReason, 240),
            similarityRoute: truncateText(generation.similarityRoute, 40),
            similarityReason: truncateText(generation.similarityReason, 240),
            durabilityReason: truncateText(generation.durabilityReason, 240),
            recommendedPin: !!generation.recommendedPin,
            recommendedMute: !!generation.recommendedMute,
            acceptedAsOperation: truncateText(generation.acceptedAsOperation, 24),
            acceptedTargetEntryId: truncateText(generation.acceptedTargetEntryId, 140),
            acceptedAt: Number.isFinite(Number(generation.acceptedAt)) ? Number(generation.acceptedAt) : 0,
            candidateCategory: truncateText(generation.candidateCategory, 60),
            generatedAt: Number.isFinite(Number(generation.generatedAt)) ? Number(generation.generatedAt) : 0,
            targetTotal: Number.isFinite(Number(generation.targetTotal)) ? Number(generation.targetTotal) : 0,
        };
    }
    const sagaLoredeck = normalized?.extensions?.sagaLoredeck;
    const compactLoredeck = compactSagaLoredeckExtension(sagaLoredeck);
    if (compactLoredeck) out.sagaLoredeck = compactLoredeck;
    const sagaContextGate = normalized?.extensions?.sagaContextGate;
    const compactContextGate = compactSagaContextGateExtension(sagaContextGate);
    if (compactContextGate) out.sagaContextGate = compactContextGate;
    const relevanceMigration = normalized?.extensions?.relevanceMigration;
    if (relevanceMigration && typeof relevanceMigration === 'object') out.relevanceMigration = {
        migratedAt: Number.isFinite(Number(relevanceMigration.migratedAt)) ? Number(relevanceMigration.migratedAt) : 0,
        previousLifecycleStatus: truncateText(relevanceMigration.previousLifecycleStatus, 40),
        localRelevanceScore: Number.isFinite(Number(relevanceMigration.localRelevanceScore)) ? Number(relevanceMigration.localRelevanceScore) : 0,
        temporalRole: truncateText(relevanceMigration.temporalRole, 40),
    };
    const autoRelevance = normalized?.extensions?.autoRelevance;
    if (autoRelevance && typeof autoRelevance === 'object') out.autoRelevance = {
        mode: truncateText(autoRelevance.mode, 20),
        confidence: Number.isFinite(Number(autoRelevance.confidence)) ? Number(autoRelevance.confidence) : 0,
        reason: truncateText(autoRelevance.reason, 240),
        updatedAt: Number.isFinite(Number(autoRelevance.updatedAt)) ? Number(autoRelevance.updatedAt) : 0,
    };
    const pendingReview = normalized?.extensions?.sagaPendingReview;
    if (pendingReview && typeof pendingReview === 'object') out.sagaPendingReview = pendingReview;
    return Object.keys(out).length ? out : undefined;
}

function compactLoreEntryForStorage(entry) {
    const normalized = normalizeLoreEntry(prePruneLoreEntryForNormalization(entry || {}));
    const contextBlock = compactLoreContextForStorage(normalized.context);
    const coordinates = compactLoreCoordinatesForStorage(normalized.coordinates);
    return {
        schemaVersion: normalized.schemaVersion || 2,
        id: truncateText(normalized.id, 140),
        title: truncateText(normalized.title, 180),
        kind: normalized.kind || 'fact',
        gateType: normalized.gateType || normalized.kind || 'fact',
        category: normalized.category || 'other',
        relevance: normalizeLoreRelevance(normalized.relevance || 'normal'),
        lorePurpose: normalizeLorePurpose(normalized.lorePurpose || normalized.purpose, normalized),
        specificityScore: Number.isFinite(Number(normalized.specificityScore)) ? Math.max(0, Math.min(100, Number(normalized.specificityScore))) : computeSpecificityScore(normalized),
        injectableByDefault: normalized.injectableByDefault !== false,
        canon: normalizeLoreCanon(normalized.canon || normalized.canonStatus, normalized.source || normalized.sourceInfo?.work || ''),
        canonStatus: normalizeLoreCanon(normalized.canon || normalized.canonStatus, normalized.source || normalized.sourceInfo?.work || ''),
        truthStatus: normalized.truthStatus || 'true',
        revealPolicy: normalized.revealPolicy || 'private',
        tags: compactStringArray(normalized.tags, 10, 40),
        priority: Number.isFinite(Number(normalized.priority)) ? Number(normalized.priority) : 50,
        status: normalized.status || 'active',
        protected: !!normalized.protected,
        locked: !!normalized.locked,
        userEditable: normalized.userEditable !== false,
        userEdited: !!normalized.userEdited,
        branchId: truncateText(normalized.branchId, 100) || 'main',
        date: {
            validFrom: truncateText(normalized.date?.validFrom || normalized.validFrom, 32),
            validTo: truncateText(normalized.date?.validTo || normalized.validTo, 32),
            precision: truncateText(normalized.date?.precision, 32),
            schoolYear: normalized.date?.schoolYear ?? null,
            book: truncateText(normalized.date?.book, 100),
            era: truncateText(normalized.date?.era, 100),
            label: truncateText(normalized.date?.label, 140),
        },
        canonTiming: {
            canonExpectedFrom: truncateText(normalized.canonTiming?.canonExpectedFrom, 32),
            canonExpectedUntil: truncateText(normalized.canonTiming?.canonExpectedUntil, 32),
            hardValidFrom: truncateText(normalized.canonTiming?.hardValidFrom, 32),
            hardValidTo: truncateText(normalized.canonTiming?.hardValidTo, 32),
            precision: truncateText(normalized.canonTiming?.precision, 32),
            schoolYear: normalized.canonTiming?.schoolYear ?? null,
            book: truncateText(normalized.canonTiming?.book, 100),
            label: truncateText(normalized.canonTiming?.label, 140),
        },
        ...(contextBlock ? { context: contextBlock } : {}),
        ...(coordinates.length ? { coordinates } : {}),
        activation: {
            requiresEvents: compactStringArray(normalized.activation?.requiresEvents, 10, 100),
            requiresMissingEvents: compactStringArray(normalized.activation?.requiresMissingEvents, 10, 100),
            requiresCharacters: compactStringArray(normalized.activation?.requiresCharacters, 10, 100),
            requiresLocation: compactStringArray(normalized.activation?.requiresLocation, 5, 100),
            requiresTopics: compactStringArray(normalized.activation?.requiresTopics, 10, 100),
            requiresCanonStrictness: truncateText(normalized.activation?.requiresCanonStrictness, 32),
        },
        expiration: {
            expiresWhenEventsHappen: compactStringArray(normalized.expiration?.expiresWhenEventsHappen, 10, 100),
            expiresWhenEntriesActive: compactStringArray(normalized.expiration?.expiresWhenEntriesActive, 10, 100),
            autoMuteOnExpire: normalized.expiration?.autoMuteOnExpire !== false,
        },
        lifecycle: {
            status: truncateText(normalized.lifecycle?.status, 32),
            computedStatus: truncateText(normalized.lifecycle?.computedStatus, 32),
            manualOverride: !!normalized.lifecycle?.manualOverride,
            expired: !!normalized.lifecycle?.expired,
            expiredAt: truncateText(normalized.lifecycle?.expiredAt, 32),
            expiredReason: truncateText(normalized.lifecycle?.expiredReason, 200),
            autoMutedOnExpire: !!normalized.lifecycle?.autoMutedOnExpire,
            lastEvaluatedAt: Number.isFinite(Number(normalized.lifecycle?.lastEvaluatedAt)) ? Number(normalized.lifecycle.lastEvaluatedAt) : 0,
            lastEvaluatedDate: truncateText(normalized.lifecycle?.lastEvaluatedDate, 32),
            reason: truncateText(normalized.lifecycle?.reason, 200),
        },
        scope: {
            characters: compactStringArray(normalized.scope?.characters, 12, 100),
            locations: compactStringArray(normalized.scope?.locations, 10, 100),
            factions: compactStringArray(normalized.scope?.factions, 10, 100),
            topics: compactStringArray(normalized.scope?.topics, 14, 100),
            objects: compactStringArray(normalized.scope?.objects, 10, 100),
            spells: compactStringArray(normalized.scope?.spells, 10, 100),
            schoolYears: compactStringArray(normalized.scope?.schoolYears, 8, 32),
            books: compactStringArray(normalized.scope?.books, 8, 100),
            eras: compactStringArray(normalized.scope?.eras, 8, 100),
        },
        visibility: {
            publicFrom: truncateText(normalized.visibility?.publicFrom, 32),
            secretUntil: truncateText(normalized.visibility?.secretUntil, 32),
            knownBy: compactStringMapForStorage(normalized.visibility?.knownBy, 16, 120),
            notKnownByBefore: compactStringMapForStorage(normalized.visibility?.notKnownByBefore, 16, 120),
            knownByAtContext: compactPlainObjectMapForStorage(normalized.visibility?.knownByAtContext, 16, 120),
            notKnownByBeforeContext: compactPlainObjectMapForStorage(normalized.visibility?.notKnownByBeforeContext, 16, 120),
            neverKnownBy: compactStringArray(normalized.visibility?.neverKnownBy, 16, 120),
            publicFromContext: normalized.visibility?.publicFromContext || {},
            secretUntilContext: normalized.visibility?.secretUntilContext || {},
            suspectedBy: compactStringMapForStorage(normalized.visibility?.suspectedBy, 12, 120),
        },
        retrieval: {
            activation: truncateText(normalized.retrieval?.activation, 40),
            frequency: truncateText(normalized.retrieval?.frequency, 40),
            contextBoost: truncateText(normalized.retrieval?.contextBoost, 40),
            triggers: {
                charactersAny: compactStringArray(normalized.retrieval?.triggers?.charactersAny, 12, 100),
                locationsAny: compactStringArray(normalized.retrieval?.triggers?.locationsAny, 10, 100),
                topicsAny: compactStringArray(normalized.retrieval?.triggers?.topicsAny, 20, 100),
                erasAny: compactStringArray(normalized.retrieval?.triggers?.erasAny, 8, 100),
            },
        },
        content: {
            fact: truncateText(normalized.content?.fact || normalized.fact, 1200),
            injection: truncateText(normalized.content?.injection, 1200),
            constraints: compactStringArray(normalized.content?.constraints, 8, 260),
            antiLore: compactStringArray(normalized.content?.antiLore, 8, 260),
            publicVersion: truncateText(normalized.content?.publicVersion, 500),
            notes: truncateText(normalized.content?.notes || normalized.notes, 600),
        },
        fact: truncateText(normalized.fact || normalized.content?.fact, 1200),
        source: typeof normalized.source === 'string' ? truncateText(normalized.source, 180) : 'saga',
        sourceInfo: {
            work: truncateText(normalized.sourceInfo?.work, 100),
            book: truncateText(normalized.sourceInfo?.book, 100),
            chapter: truncateText(normalized.sourceInfo?.chapter, 100),
            confidence: normalized.sourceInfo?.confidence,
        },
        extensions: compactLoreExtensionsForStorage(normalized),
    };
}

function compactCompressionStatusForStorage(status) {
    if (!status || typeof status !== 'object' || Array.isArray(status)) return status;
    const out = { ...status };
    const signature = typeof out.lastSignature === 'string' ? out.lastSignature : '';
    if (signature.length > 1200 || signature.includes('"directText"')) {
        out.lastSignature = '';
    }
    return out;
}

function sanitizeCompressionStatusesForStorage(state) {
    if (!state || typeof state !== 'object') return state;
    state.continuityCompressionStatus = compactCompressionStatusForStorage(state.continuityCompressionStatus || {});
    state.loreCompressionStatus = compactCompressionStatusForStorage(state.loreCompressionStatus || {});
    if (state.loreCompressionStatusByRelevance && typeof state.loreCompressionStatusByRelevance === 'object' && !Array.isArray(state.loreCompressionStatusByRelevance)) {
        state.loreCompressionStatusByRelevance = Object.fromEntries(
            Object.entries(state.loreCompressionStatusByRelevance)
                .map(([tier, status]) => [tier, compactCompressionStatusForStorage(status || {})])
        );
    }
    return state;
}

function sanitizeLoreArraysForStorage(state) {
    if (!state || typeof state !== 'object') return state;
    sanitizeCompressionStatusesForStorage(state);

    if (Array.isArray(state.pendingLoreEntries)) {
        state.pendingLoreEntries = state.pendingLoreEntries
            .slice(0, MAX_PENDING_LORE_ENTRIES)
            .map(compactLoreEntryForStorage);
    } else {
        state.pendingLoreEntries = [];
    }

    if (Array.isArray(state.loreMatrix)) {
        if (!state.loreSelection || typeof state.loreSelection !== 'object') state.loreSelection = { pinnedIds: [], suppressedIds: [] };
        state.loreSelection.suppressedIds = Array.isArray(state.loreSelection.suppressedIds) ? state.loreSelection.suppressedIds : [];
        const suppressedSet = new Set(state.loreSelection.suppressedIds);
        const cap = Number(MAX_ACCEPTED_LORE_ENTRIES_FOR_AUTOSANITIZE) || 0;
        const limited = cap > 0 && state.loreMatrix.length > cap
            ? state.loreMatrix.slice(-cap)
            : state.loreMatrix;
        state.loreMatrix = limited.map(raw => {
            // Relevance-tier architecture: lifecycle/date evaluation may add review
            // metadata, but it must not secretly mutate mute/injection state. Mute is
            // the only hard injection exclusion control.
            let evaluated = raw;
            try { evaluated = applyLoreLifecycleEvaluation(raw, state); } catch (_) { evaluated = raw; }
            return compactLoreEntryForStorage(evaluated);
        });
        state.loreSelection.suppressedIds = Array.from(suppressedSet);
    } else {
        state.loreMatrix = [];
    }

    stripRetiredStateHistoryFields(state);

    state.loreTimeline = normalizeLoreTimeline(state.loreTimeline || {});

    if (state.pendingLoreEntries.length === 0) {
        state.pendingLoreMeta = null;
    }

    if (Array.isArray(state.autoRelevanceSuggestions)) {
        state.autoRelevanceSuggestions = state.autoRelevanceSuggestions.slice(0, 100).map(s => ({
            id: truncateText(s?.id, 140),
            title: truncateText(s?.title, 180),
            currentRelevance: truncateText(s?.currentRelevance, 20),
            suggestedRelevance: truncateText(s?.suggestedRelevance, 20),
            confidence: Number.isFinite(Number(s?.confidence)) ? Number(s.confidence) : 0,
            score: Number.isFinite(Number(s?.score)) ? Number(s.score) : 0,
            temporalRole: truncateText(s?.temporalRole, 40),
            source: truncateText(s?.source, 20),
            reason: truncateText(s?.reason, 240),
            suggestedAt: Number.isFinite(Number(s?.suggestedAt)) ? Number(s.suggestedAt) : 0,
        })).filter(s => s.id && s.suggestedRelevance);
    } else {
        state.autoRelevanceSuggestions = [];
    }

    return state;
}

// ── State migration ─────────────────────────────────────────────────────────────

/**
 * Checks _version and applies migration steps to bring old state objects
 * forward to the current schema version.
 * @param {Object} state - Raw state from storage (may be any schema version)
 * @returns {Object} Migrated SagaState
 */
export function migrateState(state) {
    const defaults = getDefaultState();
    if (!state || typeof state !== 'object') {
        return defaults;
    }

    // Version 0 (no _version) → Version 1
    if (!state._version || state._version < 1) {
        // Ensure canon block exists
        if (!state.canon) state.canon = { ...defaults.canon };
        else {
            state.canon.era = state.canon.era || '';
            state.canon.inUniverseDate = state.canon.inUniverseDate || '';
            state.canon.canonBoundary = state.canon.canonBoundary || '';
            if (!Array.isArray(state.canon.divergences)) state.canon.divergences = [];
        }

        // Ensure scene block exists
        if (!state.scene) state.scene = { ...defaults.scene };
        else {
            state.scene.location = state.scene.location || '';
            state.scene.timeOfDay = state.scene.timeOfDay || '';
            state.scene.weather = state.scene.weather || '';
            if (!Array.isArray(state.scene.presentCharacters)) state.scene.presentCharacters = [];
            if (!Array.isArray(state.scene.nearbyCharacters)) state.scene.nearbyCharacters = [];
            state.scene.currentActivity = state.scene.currentActivity || '';
        }

        // Ensure knowledge exists
        if (!state.knowledge || typeof state.knowledge !== 'object' || Array.isArray(state.knowledge)) {
            state.knowledge = {};
        }

        // Ensure arrays exist
        if (!Array.isArray(state.secrets)) state.secrets = [];
        if (!Array.isArray(state.relationships)) state.relationships = [];
        if (!Array.isArray(state.threads)) state.threads = [];
        if (!Array.isArray(state.continuityFlags)) state.continuityFlags = [];
        if (state.lastDelta === undefined) state.lastDelta = null;

        state._version = 1;
    }

    stripRetiredStateHistoryFields(state);

    // ── Schema v1 → v2: Lore Matrix migration ───────────────────────────────
    if (state._version < 2) {
        const defaults = getDefaultState();

        // Add loreContext if missing
        state.loreContext = normalizeLoreContext(state.loreContext || {});
        if (!state.loreContext.sceneDate && state.canon?.inUniverseDate) {
            state.loreContext.sceneDate = state.canon.inUniverseDate;
        }
        if (!state.loreContext.canonBoundary && state.canon?.canonBoundary) {
            state.loreContext.canonBoundary = state.canon.canonBoundary;
        }

        // Add loreMatrix if missing
        if (!Array.isArray(state.loreMatrix)) {
            state.loreMatrix = [];
        } else {
            state.loreMatrix = normalizeLoreMatrix(state.loreMatrix);
        }

        // Add pendingLoreEntries if missing
        if (!Array.isArray(state.pendingLoreEntries)) {
            state.pendingLoreEntries = [];
        } else {
            state.pendingLoreEntries = normalizeLoreMatrix(state.pendingLoreEntries);
        }

        state._version = 2;
    }

    // ── Schema v2 → v3: Lore generation lifecycle ledger ───────────────────
    if (state._version < 3) {
        const defaults = getDefaultState();

        // Add loreGeneration ledger if missing
        if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
            state.loreGeneration = { ...defaults.loreGeneration };
        } else {
            state.loreGeneration.lastAttemptedFor = state.loreGeneration.lastAttemptedFor || '';
            state.loreGeneration.lastProposedFor = state.loreGeneration.lastProposedFor || '';
            state.loreGeneration.lastAcceptedFor = state.loreGeneration.lastAcceptedFor || '';
            state.loreGeneration.lastRejectedFor = state.loreGeneration.lastRejectedFor || '';
            state.loreGeneration.lastFailedFor = state.loreGeneration.lastFailedFor || '';
            if (!state.loreGeneration.attempts || typeof state.loreGeneration.attempts !== 'object') {
                state.loreGeneration.attempts = {};
            }
        }

        // Add pendingLoreMeta if missing (preserve existing null)
        if (state.pendingLoreMeta === undefined) {
            state.pendingLoreMeta = null;
        } else if (state.pendingLoreMeta && typeof state.pendingLoreMeta !== 'object') {
            state.pendingLoreMeta = null;
        } else if (state.pendingLoreMeta && state.pendingLoreEntries?.length === 0) {
            // Stale metadata with no actual pending entries — clean up
            state.pendingLoreMeta = null;
        }

        state._version = 3;
    }

    // ── Schema v4: lore panel UI state and lore selection ────────────────────
    if (state._version < 4) {
        const defaults = getDefaultState();
        state.lorePanel = mergeDefaults(state.lorePanel, defaults.lorePanel);
        state.loreSelection = mergeDefaults(state.loreSelection, defaults.loreSelection);
        state._version = 4;
    }

    // ── Schema v5: expanded editable continuity state and split injection preview ─────────
    if (state._version < 5) {
        const defaults = getDefaultState();
        state.continuityConfig = { ...defaults.continuityConfig, ...(state.continuityConfig || {}) };
        state.characters = Array.isArray(state.characters) ? state.characters : [];
        state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
        state.objectives = Array.isArray(state.objectives) ? state.objectives : [];
        state.continuityCompressionStatus = state.continuityCompressionStatus || defaults.continuityCompressionStatus;
        state._version = 5;
    }

    // ── Schema v7: local canon lore database status ─────────────────────────
    if (state._version < 7) {
        const defaults = getDefaultState();
        state.canonLoreDatabase = mergeDefaults(state.canonLoreDatabase, defaults.canonLoreDatabase);
        state._version = 7;
    }

    // ── Schema v8: resumable bulk lore scan ledger ─────────────────────────
    if (state._version < 8) {
        const defaults = getDefaultState();
        state.loreBulkGeneration = mergeDefaults(state.loreBulkGeneration, defaults.loreBulkGeneration);
        state._version = 8;
    }

    // ── Schema v9: resumable checkpointed continuity scan ledger ───────────
    if (state._version < 9) {
        const defaults = getDefaultState();
        state.continuityScan = mergeDefaults(state.continuityScan, defaults.continuityScan);
        state._version = 9;
    }

    // ── Schema v10: streamlined live continuity sections ─────────────────────
    if (state._version < 10) {
        disableRetiredContinuitySections(state);
        state._version = 10;
    }

    // ── Schema v12: relevance-tiered lore injection and simplified Canon/AU metadata ──
    if (state._version < 12) {
        migrateLoreCollectionsToRelevance(state);
        ensureTierCompressionStatus(state);
        state._version = 12;
    }

    // ── Schema v13: Auto-Relevance suggestions and no lifecycle-driven auto-mute ──
    if (state._version < 13) {
        state.autoRelevanceSuggestions = Array.isArray(state.autoRelevanceSuggestions) ? state.autoRelevanceSuggestions : [];
        state.autoRelevanceLastRun = state.autoRelevanceLastRun || null;
        if (Array.isArray(state.loreMatrix)) {
            state.loreMatrix = state.loreMatrix.map(entry => ({
                ...entry,
                lifecycle: {
                    ...(entry.lifecycle || {}),
                    autoMutedOnExpire: false,
                },
            }));
        }
        state._version = 13;
    }

    // ── Schema v14: Auto-Relevance model adjudication and per-suggestion review ──
    if (state._version < 14) {
        state.autoRelevanceSuggestions = Array.isArray(state.autoRelevanceSuggestions) ? state.autoRelevanceSuggestions.map(s => ({
            ...s,
            source: s.source || 'local',
        })) : [];
        state.autoRelevanceLastRun = state.autoRelevanceLastRun || null;
        state._version = 14;
    }

    // ── Schema v15: strict specific-lore purpose metadata ───────────────────
    if (state._version < 15) {
        if (Array.isArray(state.loreMatrix)) {
            state.loreMatrix = state.loreMatrix.map(entry => ({
                ...entry,
                lorePurpose: normalizeLorePurpose(entry?.lorePurpose || entry?.purpose, entry),
                specificityScore: Number.isFinite(Number(entry?.specificityScore)) ? Math.max(0, Math.min(100, Number(entry.specificityScore))) : computeSpecificityScore(entry),
                injectableByDefault: entry?.injectableByDefault !== false,
            }));
        }
        if (Array.isArray(state.pendingLoreEntries)) {
            state.pendingLoreEntries = state.pendingLoreEntries.map(entry => ({
                ...entry,
                lorePurpose: normalizeLorePurpose(entry?.lorePurpose || entry?.purpose, entry),
                specificityScore: Number.isFinite(Number(entry?.specificityScore)) ? Math.max(0, Math.min(100, Number(entry.specificityScore))) : computeSpecificityScore(entry),
                injectableByDefault: entry?.injectableByDefault !== false,
            }));
        }
        state._version = 15;
    }

    // ── Schema v16: runtime rail + anchored drawer layout ────────────────
    if (state._version < 16) {
        const defaults = getDefaultState();
        const previousPanel = state.lorePanel && typeof state.lorePanel === 'object' ? { ...state.lorePanel } : {};
        const hadDrawerOpen = Object.prototype.hasOwnProperty.call(previousPanel, 'drawerOpen');
        state.lorePanel = mergeDefaults(previousPanel, defaults.lorePanel);
        state.lorePanel.railMode = previousPanel.railMode === 'expanded' ? 'expanded' : defaults.lorePanel.railMode;
        state.lorePanel.drawerOpen = hadDrawerOpen ? previousPanel.drawerOpen === true : previousPanel.collapsed !== true;
        state.lorePanel.collapsed = state.lorePanel.drawerOpen !== true;
        state.lorePanel.railX = Number.isFinite(Number(previousPanel.railX)) ? Number(previousPanel.railX) : (Number.isFinite(Number(previousPanel.x)) ? Number(previousPanel.x) : defaults.lorePanel.railX);
        state.lorePanel.railY = Number.isFinite(Number(previousPanel.railY)) ? Number(previousPanel.railY) : (Number.isFinite(Number(previousPanel.y)) ? Number(previousPanel.y) : defaults.lorePanel.railY);
        state.lorePanel.drawerWidth = Number.isFinite(Number(previousPanel.drawerWidth)) ? Number(previousPanel.drawerWidth) : (Number.isFinite(Number(previousPanel.width)) ? Number(previousPanel.width) : defaults.lorePanel.drawerWidth);
        state.lorePanel.drawerHeight = Number.isFinite(Number(previousPanel.drawerHeight)) ? Number(previousPanel.drawerHeight) : (Number.isFinite(Number(previousPanel.height)) ? Number(previousPanel.height) : defaults.lorePanel.drawerHeight);
        state.lorePanel.drawerDirection = ['auto', 'right', 'left'].includes(previousPanel.drawerDirection) ? previousPanel.drawerDirection : defaults.lorePanel.drawerDirection;
        state.lorePanel.x = state.lorePanel.railX;
        state.lorePanel.y = state.lorePanel.railY;
        state.lorePanel.width = state.lorePanel.drawerWidth;
        state.lorePanel.height = state.lorePanel.drawerHeight;
        state._version = 16;
    }

    // Schema v18: lore event timeline owns lore recovery metadata.
    if (state._version < 18) {
        state.loreTimeline = normalizeLoreTimeline(state.loreTimeline || getDefaultState().loreTimeline);
        state._version = 18;
    }

    // Schema v19: Saga Loredeck stack/context scaffolding
    if (state._version < 19) {
        state.loredeckStack = normalizeLoredeckStack(state.loredeckStack);
        state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
        state._version = 19;
    }

    // Schema v20: Saga Loredeck registry for bundled/custom/generated library metadata
    if (state._version < 20) {
        state.loredeckRegistry = normalizeLoredeckRegistry(state.loredeckRegistry);
        state._version = 20;
    }

    // Schema v21: normalized per-Loredeck Context state
    if (state._version < 21) {
        state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
        state._version = 21;
    }

    // Schema v22: replace the monolithic bundled HP Loredeck with the split HP family
    if (state._version < 22) {
        migrateLegacyHpLoredeckState(state);
        state._version = 22;
    }

    // Schema v23: persistent, resumable Loredeck Creator jobs
    if (state._version < 23) {
        state.loredeckCreator = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
        state._version = 23;
    }

    // Schema v24: generalized Context Brief plus richer Loredeck Context fields
    if (state._version < 24) {
        state.contextBrief = normalizeContextBrief(state.contextBrief || {}, state.loreContext || {});
        state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
        state._version = 24;
    }

    // ── Always normalize lore fields post-migration ────────────────────────
    // First compact known-heavy canon DB payloads and oversized pending batches so
    // a poisoned chat can recover instead of freezing during panel render/save.
    sanitizeLoreArraysForStorage(state);
    // Even v4 states can become malformed through manual editing or old imports.
    state.loreContext = normalizeLoreContext(state.loreContext || {});
    state.contextBrief = normalizeContextBrief(state.contextBrief || {}, state.loreContext || {});
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []);
    state.pendingLoreEntries = normalizeLoreMatrix(state.pendingLoreEntries || []);
    state.loreTimeline = normalizeLoreTimeline(state.loreTimeline || {});
    sanitizeLoreArraysForStorage(state);

    normalizeContinuityStructure(state);
    migrateLegacyHpLoredeckState(state);
    clearDefaultHpLoredeckStackOnce(state);
    state.loredeckStack = normalizeLoredeckStack(state.loredeckStack);
    state.loredeckRegistry = normalizeLoredeckRegistry(state.loredeckRegistry);
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    promoteChatLoredeckRegistryToSettings(state);
    promoteChatLoredeckCreatorToSettings(state);
    state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);

    if (!state.loreCompressionStatus || typeof state.loreCompressionStatus !== 'object') {
        state.loreCompressionStatus = getDefaultState().loreCompressionStatus;
    } else {
        const defaults = getDefaultState().loreCompressionStatus;
        state.loreCompressionStatus = mergeDefaults(state.loreCompressionStatus, defaults);
        normalizeCompressionStatusNumbers(state.loreCompressionStatus);
    }
    ensureTierCompressionStatus(state);

    // Normalize lorePanel
    if (!state.lorePanel || typeof state.lorePanel !== 'object') {
        state.lorePanel = getDefaultState().lorePanel;
    } else {
        const defaultsPanel = getDefaultState().lorePanel;
        state.lorePanel.isOpen = state.lorePanel.isOpen !== false;
        state.lorePanel.railMode = state.lorePanel.railMode === 'expanded' ? 'expanded' : 'compact';
        state.lorePanel.drawerOpen = state.lorePanel.drawerOpen === true;
        state.lorePanel.collapsed = state.lorePanel.drawerOpen !== true;
        state.lorePanel.drawerDirection = ['auto', 'right', 'left'].includes(state.lorePanel.drawerDirection) ? state.lorePanel.drawerDirection : 'auto';
        state.lorePanel.railX = Number.isFinite(Number(state.lorePanel.railX)) ? Number(state.lorePanel.railX) : (Number.isFinite(Number(state.lorePanel.x)) ? Number(state.lorePanel.x) : defaultsPanel.railX);
        state.lorePanel.railY = Number.isFinite(Number(state.lorePanel.railY)) ? Number(state.lorePanel.railY) : (Number.isFinite(Number(state.lorePanel.y)) ? Number(state.lorePanel.y) : defaultsPanel.railY);
        state.lorePanel.drawerWidth = Number.isFinite(Number(state.lorePanel.drawerWidth)) && Number(state.lorePanel.drawerWidth) >= 320 ? Number(state.lorePanel.drawerWidth) : (Number.isFinite(Number(state.lorePanel.width)) ? Number(state.lorePanel.width) : defaultsPanel.drawerWidth);
        state.lorePanel.drawerHeight = Number.isFinite(Number(state.lorePanel.drawerHeight)) && Number(state.lorePanel.drawerHeight) >= 260 ? Number(state.lorePanel.drawerHeight) : (Number.isFinite(Number(state.lorePanel.height)) ? Number(state.lorePanel.height) : defaultsPanel.drawerHeight);
        state.lorePanel.selectedCategory = state.lorePanel.selectedCategory || 'all';
        state.lorePanel.search = state.lorePanel.search || '';
        state.lorePanel.selectedEntryId = state.lorePanel.selectedEntryId || '';
        state.lorePanel.selectedLoredeckId = String(state.lorePanel.selectedLoredeckId || defaultsPanel.selectedLoredeckId || '').trim();
        state.lorePanel.loredeckLibraryDetailsHeight = Number.isFinite(Number(state.lorePanel.loredeckLibraryDetailsHeight))
            ? Math.max(190, Math.min(560, Number(state.lorePanel.loredeckLibraryDetailsHeight)))
            : defaultsPanel.loredeckLibraryDetailsHeight;
        state.lorePanel.loredeckLibraryDetailsCollapsed = state.lorePanel.loredeckLibraryDetailsCollapsed === true;
        state.lorePanel.activeTab = ['loredecks', 'session', 'continuity', 'context', 'lore', 'injection', 'settings'].includes(state.lorePanel.activeTab)
            ? state.lorePanel.activeTab
            : (state.lorePanel.activeTab === 'generate' ? 'context' : (state.lorePanel.activeTab === 'review' ? 'lore' : 'session'));
        state.lorePanel.guidedTask = state.lorePanel.guidedTask && typeof state.lorePanel.guidedTask === 'object'
            ? {
                id: String(state.lorePanel.guidedTask.id || '').trim(),
                source: String(state.lorePanel.guidedTask.source || '').trim(),
                sourceTab: String(state.lorePanel.guidedTask.sourceTab || '').trim(),
                targetTab: ['loredecks', 'session', 'context', 'lore', 'settings'].includes(state.lorePanel.guidedTask.targetTab) ? state.lorePanel.guidedTask.targetTab : '',
                target: String(state.lorePanel.guidedTask.target || '').trim(),
                fallbackTarget: String(state.lorePanel.guidedTask.fallbackTarget || '').trim(),
                expandSections: Array.isArray(state.lorePanel.guidedTask.expandSections)
                    ? state.lorePanel.guidedTask.expandSections.map(sectionId => String(sectionId || '').trim()).filter(Boolean).slice(0, 8)
                    : [],
                prepare: String(state.lorePanel.guidedTask.prepare || '').trim(),
                readinessRowId: String(state.lorePanel.guidedTask.readinessRowId || '').trim(),
                title: String(state.lorePanel.guidedTask.title || '').trim(),
                body: String(state.lorePanel.guidedTask.body || '').trim(),
                statusText: String(state.lorePanel.guidedTask.statusText || '').trim(),
                doneText: String(state.lorePanel.guidedTask.doneText || '').trim(),
                targetMissingText: String(state.lorePanel.guidedTask.targetMissingText || '').trim(),
                nextLabel: String(state.lorePanel.guidedTask.nextLabel || '').trim(),
                nextTarget: String(state.lorePanel.guidedTask.nextTarget || '').trim(),
                nextTooltip: String(state.lorePanel.guidedTask.nextTooltip || '').trim(),
                status: ['active', 'target_missing', 'done'].includes(String(state.lorePanel.guidedTask.status || '').trim())
                    ? String(state.lorePanel.guidedTask.status || '').trim()
                    : 'active',
                startedAt: Number.isFinite(Number(state.lorePanel.guidedTask.startedAt)) ? Number(state.lorePanel.guidedTask.startedAt) : 0,
            }
            : null;
        if (!state.lorePanel.guidedTask?.id || !state.lorePanel.guidedTask?.targetTab) state.lorePanel.guidedTask = null;
        state.lorePanel.reviewSelectedIds = Array.isArray(state.lorePanel.reviewSelectedIds) ? state.lorePanel.reviewSelectedIds : [];
        state.lorePanel.generationStatus = typeof state.lorePanel.generationStatus === 'string' ? state.lorePanel.generationStatus : 'Idle.';
        state.lorePanel.generationProgress = Number.isFinite(Number(state.lorePanel.generationProgress)) ? Number(state.lorePanel.generationProgress) : 0;
        for (const key of ['context', 'continuity', 'lore']) {
            const statusKey = `${key}Status`;
            const progressKey = `${key}Progress`;
            state.lorePanel[statusKey] = typeof state.lorePanel[statusKey] === 'string'
                ? state.lorePanel[statusKey]
                : (key === 'lore' ? state.lorePanel.generationStatus : 'Idle.');
            state.lorePanel[progressKey] = Number.isFinite(Number(state.lorePanel[progressKey]))
                ? Number(state.lorePanel[progressKey])
                : (key === 'lore' ? Number(state.lorePanel.generationProgress || 0) : 0);
        }
        state.lorePanel.showOnlyActive = false;
        state.lorePanel.pendingReviewVisibleLimit = Number.isFinite(Number(state.lorePanel.pendingReviewVisibleLimit))
            ? Math.max(5, Math.min(1000, Number(state.lorePanel.pendingReviewVisibleLimit)))
            : getDefaultState().lorePanel.pendingReviewVisibleLimit;
        state.lorePanel.width = Number.isFinite(Number(state.lorePanel.width)) && Number(state.lorePanel.width) >= 320 ? Number(state.lorePanel.width) : state.lorePanel.drawerWidth;
        state.lorePanel.height = Number.isFinite(Number(state.lorePanel.height)) && Number(state.lorePanel.height) >= 260 ? Number(state.lorePanel.height) : state.lorePanel.drawerHeight;
        state.lorePanel.x = Number.isFinite(Number(state.lorePanel.x)) ? Number(state.lorePanel.x) : state.lorePanel.railX;
        state.lorePanel.y = Number.isFinite(Number(state.lorePanel.y)) ? Number(state.lorePanel.y) : state.lorePanel.railY;
    }

    // Normalize loreSelection
    if (!state.loreSelection || typeof state.loreSelection !== 'object') {
        state.loreSelection = getDefaultState().loreSelection;
    } else {
        state.loreSelection.pinnedIds = Array.isArray(state.loreSelection.pinnedIds) ? state.loreSelection.pinnedIds : [];
        state.loreSelection.suppressedIds = Array.isArray(state.loreSelection.suppressedIds) ? state.loreSelection.suppressedIds : [];
    }

    if (!state.canonLoreDatabase || typeof state.canonLoreDatabase !== 'object' || Array.isArray(state.canonLoreDatabase)) {
        state.canonLoreDatabase = getDefaultState().canonLoreDatabase;
    } else {
        state.canonLoreDatabase = mergeDefaults(state.canonLoreDatabase, getDefaultState().canonLoreDatabase);
        state.canonLoreDatabase.lastQueriedAt = Number.isFinite(Number(state.canonLoreDatabase.lastQueriedAt)) ? Number(state.canonLoreDatabase.lastQueriedAt) : 0;
        state.canonLoreDatabase.lastMatchedCount = Number.isFinite(Number(state.canonLoreDatabase.lastMatchedCount)) ? Number(state.canonLoreDatabase.lastMatchedCount) : 0;
        state.canonLoreDatabase.lastProposedCount = Number.isFinite(Number(state.canonLoreDatabase.lastProposedCount)) ? Number(state.canonLoreDatabase.lastProposedCount) : 0;
    }

    // Ensure ledger always has a valid structure
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    if (typeof state.loreGeneration.attempts !== 'object' || Array.isArray(state.loreGeneration.attempts)) {
        state.loreGeneration.attempts = {};
    }

    if (!state.loreBulkGeneration || typeof state.loreBulkGeneration !== 'object' || Array.isArray(state.loreBulkGeneration)) {
        state.loreBulkGeneration = getDefaultState().loreBulkGeneration;
    } else {
        const defaults = getDefaultState().loreBulkGeneration;
        state.loreBulkGeneration = mergeDefaults(state.loreBulkGeneration, defaults);
        for (const key of ['batches', 'chunks', 'candidates']) {
            if (!state.loreBulkGeneration[key] || typeof state.loreBulkGeneration[key] !== 'object' || Array.isArray(state.loreBulkGeneration[key])) {
                state.loreBulkGeneration[key] = {};
            }
        }
        state.loreBulkGeneration.activeBatchId = String(state.loreBulkGeneration.activeBatchId || '');
        state.loreBulkGeneration.lastBatchId = String(state.loreBulkGeneration.lastBatchId || '');
    }


    if (!state.continuityScan || typeof state.continuityScan !== 'object' || Array.isArray(state.continuityScan)) {
        state.continuityScan = getDefaultState().continuityScan;
    } else {
        const defaults = getDefaultState().continuityScan;
        state.continuityScan = mergeDefaults(state.continuityScan, defaults);
        for (const key of ['batches', 'chunks', 'observations']) {
            if (!state.continuityScan[key] || typeof state.continuityScan[key] !== 'object' || Array.isArray(state.continuityScan[key])) {
                state.continuityScan[key] = {};
            }
        }
        state.continuityScan.activeBatchId = String(state.continuityScan.activeBatchId || '');
        state.continuityScan.lastBatchId = String(state.continuityScan.lastBatchId || '');
    }
    // Clean up orphaned metadata
    if (state.pendingLoreMeta && state.pendingLoreEntries?.length === 0) {
        state.pendingLoreMeta = null;
    }

    return state;
}



function normalizeCompressionStatusNumbers(status) {
    if (!status || typeof status !== 'object') return;
    for (const key of [
        'lastCompressedAt',
        'lastTokenEstimate',
        'lastCharacterCount',
        'lastDirectTokenEstimate',
        'lastDirectCharacterCount',
        'lastTargetTokenEstimate',
        'lastTargetCharacterCount',
        'lastHardTokenLimit',
        'lastHardCharacterLimit',
        'lastCompressionRatio',
        'turnsSinceCompression',
        'lastChatLength',
    ]) {
        status[key] = Number.isFinite(Number(status[key])) ? Number(status[key]) : 0;
    }
}


// ── Continuity structure helpers ───────────────────────────────────────────────

function normalizeContinuityStructure(state) {
    const defaults = getDefaultState();

    if (!state.continuityConfig || typeof state.continuityConfig !== 'object' || Array.isArray(state.continuityConfig)) {
        state.continuityConfig = { ...defaults.continuityConfig };
    } else {
        state.continuityConfig = { ...defaults.continuityConfig, ...state.continuityConfig };
        for (const key of Object.keys(defaults.continuityConfig)) {
            state.continuityConfig[key] = state.continuityConfig[key] !== false;
        }
    }
    disableRetiredContinuitySections(state);

    if (!state.scene || typeof state.scene !== 'object' || Array.isArray(state.scene)) {
        state.scene = { ...defaults.scene };
    } else {
        state.scene = { ...defaults.scene, ...state.scene };
        state.scene.presentCharacters = Array.isArray(state.scene.presentCharacters) ? state.scene.presentCharacters.filter(Boolean).map(String) : [];
        state.scene.nearbyCharacters = Array.isArray(state.scene.nearbyCharacters) ? state.scene.nearbyCharacters.filter(Boolean).map(String) : [];
    }

    if (!state.storyMilestones || typeof state.storyMilestones !== 'object' || Array.isArray(state.storyMilestones)) {
        state.storyMilestones = {};
    } else {
        state.storyMilestones = Object.fromEntries(Object.entries(state.storyMilestones).map(([id, value]) => [String(id), normalizeStoryMilestone(value)]));
    }

    normalizeStateEntries(state);

    if (!state.continuityCompressionStatus || typeof state.continuityCompressionStatus !== 'object') {
        state.continuityCompressionStatus = getDefaultState().continuityCompressionStatus;
    } else {
        const defaults = getDefaultState().continuityCompressionStatus;
        state.continuityCompressionStatus = mergeDefaults(state.continuityCompressionStatus, defaults);
        normalizeCompressionStatusNumbers(state.continuityCompressionStatus);
    }
}

function isSectionEnabled(state, section) {
    return state?.continuityConfig?.[section] !== false;
}

function applyArrayDelta(target, patch, identityKey, normalizer) {
    if (!Array.isArray(target) || !patch || typeof patch !== 'object') return;

    if (Array.isArray(patch.added)) {
        for (const item of patch.added) {
            target.push(normalizer(item));
        }
    }

    if (Array.isArray(patch.updated)) {
        for (const upd of patch.updated) {
            let idx = Number.isInteger(upd.index) ? upd.index : -1;
            if (idx < 0 && upd[identityKey]) {
                const wanted = String(upd[identityKey]).toLowerCase();
                idx = target.findIndex(item => String(item?.[identityKey] || '').toLowerCase() === wanted);
            }
            if (idx >= 0 && idx < target.length) {
                const merged = { ...target[idx], ...(upd.changes || {}) };
                if (upd.changes?.emotionalState && target[idx]?.emotionalState) {
                    merged.emotionalState = {
                        ...target[idx].emotionalState,
                        ...upd.changes.emotionalState,
                        lastUpdatedAt: Date.now(),
                        lastUpdatedChatLength: getCurrentChatLength(),
                    };
                }
                target[idx] = normalizer(merged);
            }
        }
    }

    if (Array.isArray(patch.removed)) {
        const removals = new Set();
        for (const raw of patch.removed) {
            if (Number.isInteger(raw)) {
                removals.add(raw);
            } else if (typeof raw === 'string') {
                const wanted = raw.toLowerCase();
                const idx = target.findIndex(item => String(item?.[identityKey] || '').toLowerCase() === wanted);
                if (idx >= 0) removals.add(idx);
            }
        }
        const sorted = [...removals].sort((a, b) => b - a);
        for (const idx of sorted) {
            if (idx >= 0 && idx < target.length) target.splice(idx, 1);
        }
    }
}

function sanitizeCharacterPatchForConfig(patch, state) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;

    const appearanceEnabled = isSectionEnabled(state, 'appearance');
    const emotionalStateEnabled = isSectionEnabled(state, 'emotionalState');
    if (appearanceEnabled && emotionalStateEnabled) return patch;

    const sanitized = { ...patch };
    const sanitizeCharacter = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const next = { ...raw };
        if (!appearanceEnabled) delete next.clothing;
        if (!emotionalStateEnabled) delete next.emotionalState;
        return next;
    };
    const sanitizeUpdate = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const next = { ...raw };
        if (next.changes && typeof next.changes === 'object' && !Array.isArray(next.changes)) {
            next.changes = sanitizeCharacter(next.changes);
        }
        return next;
    };

    if (Array.isArray(sanitized.added)) sanitized.added = sanitized.added.map(sanitizeCharacter);
    if (Array.isArray(sanitized.updated)) sanitized.updated = sanitized.updated.map(sanitizeUpdate);
    return sanitized;
}

function clampEmotion(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(-5, Math.min(5, Math.round(n)));
}

function clampConfidence(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n));
}

function normalizeEmotionalState(raw = {}) {
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        affection: clampEmotion(src.affection),
        trust: clampEmotion(src.trust),
        desire: clampEmotion(src.desire),
        connection: clampEmotion(src.connection),
        fear: clampEmotion(src.fear),
        anger: clampEmotion(src.anger),
        sadness: clampEmotion(src.sadness),
        joy: clampEmotion(src.joy),
        notes: typeof src.notes === 'string' ? src.notes : '',
        confidence: clampConfidence(src.confidence),
        lastUpdatedAt: Number.isFinite(Number(src.lastUpdatedAt)) ? Number(src.lastUpdatedAt) : Date.now(),
        lastUpdatedChatLength: Number.isFinite(Number(src.lastUpdatedChatLength)) ? Number(src.lastUpdatedChatLength) : getCurrentChatLength(),
    };
}

function getCurrentChatLength() {
    try {
        const ctx = SillyTavern.getContext();
        return Array.isArray(ctx?.chat) ? ctx.chat.length : 0;
    } catch (_) {
        return 0;
    }
}

function normalizeCharacter(raw = {}) {
    const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const emotionalState = normalizeEmotionalState(c.emotionalState || {});
    return {
        name: typeof c.name === 'string' ? c.name.trim() : '',
        aliases: Array.isArray(c.aliases) ? c.aliases.filter(Boolean).map(String) : [],
        role: typeof c.role === 'string' ? c.role : '',
        location: typeof c.location === 'string' ? c.location : '',
        clothing: typeof c.clothing === 'string' ? c.clothing : '',
        posture: typeof c.posture === 'string' ? c.posture : '',
        physicalState: typeof c.physicalState === 'string' ? c.physicalState : '',
        emotionalState,
        inventory: Array.isArray(c.inventory) ? c.inventory.filter(Boolean).map(String) : [],
        goals: Array.isArray(c.goals) ? c.goals.filter(Boolean).map(String) : [],
        notes: typeof c.notes === 'string' ? c.notes : '',
    };
}

function normalizeInventoryItem(raw = {}) {
    const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
        owner: typeof item.owner === 'string' ? item.owner : '',
        item: typeof item.item === 'string' ? item.item : '',
        status: typeof item.status === 'string' ? item.status : '',
        location: typeof item.location === 'string' ? item.location : '',
        notes: typeof item.notes === 'string' ? item.notes : '',
    };
}

function normalizeObjective(raw = {}) {
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const allowed = new Set(['active', 'blocked', 'completed', 'abandoned']);
    return {
        owner: typeof obj.owner === 'string' ? obj.owner : '',
        goal: typeof obj.goal === 'string' ? obj.goal : '',
        status: allowed.has(obj.status) ? obj.status : 'active',
        stakes: typeof obj.stakes === 'string' ? obj.stakes : '',
        notes: typeof obj.notes === 'string' ? obj.notes : '',
    };
}

function normalizeStoryMilestone(raw = {}) {
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const allowed = new Set(['not_happened', 'suspected', 'happened', 'blocked', 'diverged', 'unknown']);
    return {
        status: allowed.has(obj.status) ? obj.status : 'unknown',
        happenedAtStoryDate: typeof obj.happenedAtStoryDate === 'string' ? obj.happenedAtStoryDate : '',
        happenedAtTurn: Number.isFinite(Number(obj.happenedAtTurn)) ? Number(obj.happenedAtTurn) : 0,
        evidence: Array.isArray(obj.evidence) ? obj.evidence.filter(x => typeof x === 'string') : [],
        confidence: Number.isFinite(Number(obj.confidence)) ? Math.max(0, Math.min(1, Number(obj.confidence))) : 0,
        notes: typeof obj.notes === 'string' ? obj.notes : '',
    };
}

// ── Delta validation ────────────────────────────────────────────────────────────

/** Valid enum values for validation */
const VALID_ENUMS = {
    tension: new Set(['low', 'medium', 'high', 'critical']),
    trust: new Set(['low', 'medium', 'high', 'absolute']),
    threadStatus: new Set(['active', 'dormant', 'resolved']),
    flagType: new Set(['contradiction', 'uncertainty', 'warning']),
    flagSeverity: new Set(['low', 'medium', 'high']),
};

/** Known top-level change keys */
const KNOWN_CHANGE_KEYS = new Set(ACTIVE_CONTINUITY_CHANGE_KEYS);

/**
 * Validates a SagaDelta against the schema.
 * @param {Object} delta - The delta to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDelta(delta) {
    const errors = [];

    if (!delta || typeof delta !== 'object') {
        return { valid: false, errors: ['Delta must be an object'] };
    }

    // Empty changes is valid (no-op delta)
    if (!delta.changes) {
        return { valid: false, errors: ['Delta must have a "changes" key'] };
    }

    if (typeof delta.changes !== 'object' || Array.isArray(delta.changes)) {
        return { valid: false, errors: ['Delta.changes must be an object'] };
    }

    // Accept empty changes as a valid no-op
    if (Object.keys(delta.changes).length === 0) {
        return { valid: true, errors: [] };
    }

    const changes = delta.changes;

    // Check for unknown change keys
    for (const key of Object.keys(changes)) {
        if (!KNOWN_CHANGE_KEYS.has(key)) {
            errors.push(`Unknown change key: "${key}"`);
        }
    }

    // Validate scene sub-fields with deep structural assertions
    if (changes.scene && typeof changes.scene === 'object') {
        // Type-check presentCharacters
        if (changes.scene.presentCharacters !== undefined) {
            if (!Array.isArray(changes.scene.presentCharacters)) {
                errors.push('scene.presentCharacters must be an array');
            } else {
                for (let i = 0; i < changes.scene.presentCharacters.length; i++) {
                    if (typeof changes.scene.presentCharacters[i] !== 'string') {
                        errors.push(`scene.presentCharacters[${i}] must be a string`);
                    }
                }
            }
        }
        // Type-check nearbyCharacters
        if (changes.scene.nearbyCharacters !== undefined) {
            if (!Array.isArray(changes.scene.nearbyCharacters)) {
                errors.push('scene.nearbyCharacters must be an array');
            } else {
                for (let i = 0; i < changes.scene.nearbyCharacters.length; i++) {
                    if (typeof changes.scene.nearbyCharacters[i] !== 'string') {
                        errors.push(`scene.nearbyCharacters[${i}] must be a string`);
                    }
                }
            }
        }
    }

    // Validate knowledge (character key -> array of strings)
    if (changes.knowledge && typeof changes.knowledge === 'object' && !Array.isArray(changes.knowledge)) {
        for (const [char, facts] of Object.entries(changes.knowledge)) {
            if (!Array.isArray(facts)) {
                errors.push(`knowledge.${char} must be an array of strings`);
            } else {
                for (let i = 0; i < facts.length; i++) {
                    if (typeof facts[i] !== 'string') {
                        errors.push(`knowledge.${char}[${i}] must be a string`);
                    }
                }
            }
        }
    } else if (changes.knowledge !== undefined && (typeof changes.knowledge !== 'object' || Array.isArray(changes.knowledge))) {
        errors.push('knowledge must be a character-keyed object');
    }

    // Validate secrets
    if (changes.secrets && typeof changes.secrets === 'object') {
        ['added', 'updated', 'removed'].forEach(op => {
            if (changes.secrets[op] !== undefined) {
                if (!Array.isArray(changes.secrets[op])) {
                    errors.push(`secrets.${op} must be an array`);
                } else if (op === 'updated') {
                    changes.secrets.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`secrets.updated[${i}].index must be a nonnegative integer`);
                        }
                        if (upd.changes === undefined || upd.changes === null || typeof upd.changes !== 'object' || Array.isArray(upd.changes)) {
                            errors.push(`secrets.updated[${i}].changes must be a non-null object`);
                        }
                    });
                } else if (op === 'removed') {
                    changes.secrets.removed.forEach((idx, i) => {
                        if (!Number.isInteger(idx) || idx < 0) {
                            errors.push(`secrets.removed[${i}] must be a nonnegative integer`);
                        }
                    });
                }
            }
        });
    } else if (changes.secrets !== undefined) {
        errors.push('secrets must be an object with added/updated/removed arrays');
    }

    // Validate relationships
    if (changes.relationships && typeof changes.relationships === 'object') {
        ['added', 'updated', 'removed'].forEach(op => {
            if (changes.relationships[op] !== undefined) {
                if (!Array.isArray(changes.relationships[op])) {
                    errors.push(`relationships.${op} must be an array`);
                } else if (op === 'added') {
                    changes.relationships.added.forEach((rel, i) => {
                        if (rel.tension !== undefined && !VALID_ENUMS.tension.has(rel.tension)) {
                            errors.push(`relationships.added[${i}].tension "${rel.tension}" must be low|medium|high|critical`);
                        }
                        if (rel.trust !== undefined && !VALID_ENUMS.trust.has(rel.trust)) {
                            errors.push(`relationships.added[${i}].trust "${rel.trust}" must be low|medium|high|absolute`);
                        }
                    });
                } else if (op === 'updated') {
                    changes.relationships.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`relationships.updated[${i}].index must be a nonnegative integer`);
                        }
                        // Validate enum values in the changes sub-object
                        if (upd.changes && typeof upd.changes === 'object') {
                            if (upd.changes.tension !== undefined && !VALID_ENUMS.tension.has(upd.changes.tension)) {
                                errors.push(`relationships.updated[${i}].changes.tension "${upd.changes.tension}" must be low|medium|high|critical`);
                            }
                            if (upd.changes.trust !== undefined && !VALID_ENUMS.trust.has(upd.changes.trust)) {
                                errors.push(`relationships.updated[${i}].changes.trust "${upd.changes.trust}" must be low|medium|high|absolute`);
                            }
                        }
                    });
                } else if (op === 'removed') {
                    changes.relationships.removed.forEach((idx, i) => {
                        if (!Number.isInteger(idx) || idx < 0) {
                            errors.push(`relationships.removed[${i}] must be a nonnegative integer`);
                        }
                    });
                }
            }
        });
    } else if (changes.relationships !== undefined) {
        errors.push('relationships must be an object with added/updated/removed arrays');
    }

    // Validate threads
    if (changes.threads && typeof changes.threads === 'object') {
        ['added', 'updated'].forEach(op => {
            if (changes.threads[op] !== undefined) {
                if (!Array.isArray(changes.threads[op])) {
                    errors.push(`threads.${op} must be an array`);
                } else if (op === 'added') {
                    changes.threads.added.forEach((t, i) => {
                        if (t.status !== undefined && !VALID_ENUMS.threadStatus.has(t.status)) {
                            errors.push(`threads.added[${i}].status "${t.status}" must be active|dormant|resolved`);
                        }
                    });
                } else if (op === 'updated') {
                    changes.threads.updated.forEach((upd, i) => {
                        if (!Number.isInteger(upd.index) || upd.index < 0) {
                            errors.push(`threads.updated[${i}].index must be a nonnegative integer`);
                        }
                        // Validate enum values in the changes sub-object
                        if (upd.changes && typeof upd.changes === 'object') {
                            if (upd.changes.status !== undefined && !VALID_ENUMS.threadStatus.has(upd.changes.status)) {
                                errors.push(`threads.updated[${i}].changes.status "${upd.changes.status}" must be active|dormant|resolved`);
                            }
                        }
                    });
                }
            }
        });
    } else if (changes.threads !== undefined) {
        errors.push('threads must be an object with added/updated arrays');
    }

    // Validate continuityFlags
    if (changes.continuityFlags && typeof changes.continuityFlags === 'object') {
        if (changes.continuityFlags.added !== undefined) {
            if (!Array.isArray(changes.continuityFlags.added)) {
                errors.push('continuityFlags.added must be an array');
            } else {
                changes.continuityFlags.added.forEach((f, i) => {
                    if (f.type !== undefined && !VALID_ENUMS.flagType.has(f.type)) {
                        errors.push(`continuityFlags.added[${i}].type "${f.type}" must be contradiction|uncertainty|warning`);
                    }
                    if (f.severity !== undefined && !VALID_ENUMS.flagSeverity.has(f.severity)) {
                        errors.push(`continuityFlags.added[${i}].severity "${f.severity}" must be low|medium|high`);
                    }
                });
            }
        }
        if (changes.continuityFlags.resolved !== undefined) {
            if (!Array.isArray(changes.continuityFlags.resolved)) {
                errors.push('continuityFlags.resolved must be an array');
            } else {
                changes.continuityFlags.resolved.forEach((idx, i) => {
                    if (!Number.isInteger(idx) || idx < 0) {
                        errors.push(`continuityFlags.resolved[${i}] must be a nonnegative integer`);
                    }
                });
            }
        }
    } else if (changes.continuityFlags !== undefined) {
        errors.push('continuityFlags must be an object with added/resolved arrays');
    }

    if (changes.storyMilestones && typeof changes.storyMilestones === 'object' && !Array.isArray(changes.storyMilestones)) {
        const allowed = new Set(['not_happened', 'suspected', 'happened', 'blocked', 'diverged', 'unknown']);
        for (const [id, value] of Object.entries(changes.storyMilestones)) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                errors.push(`storyMilestones.${id} must be an object`);
                continue;
            }
            if (value.status !== undefined && !allowed.has(value.status)) {
                errors.push(`storyMilestones.${id}.status must be not_happened|suspected|happened|blocked|diverged|unknown`);
            }
            if (value.evidence !== undefined && !Array.isArray(value.evidence)) {
                errors.push(`storyMilestones.${id}.evidence must be an array`);
            }
        }
    } else if (changes.storyMilestones !== undefined) {
        errors.push('storyMilestones must be an object keyed by milestone id');
    }

    return { valid: errors.length === 0, errors };
}

// ── Delta application ───────────────────────────────────────────────────────────

/**
 * Deep-merges a validated SagaDelta into the current SagaState.
 * Returns a new state object — does not mutate the input.
 *
 * @param {Object} state - Current SagaState
 * @param {Object} delta - Validated SagaDelta to apply
 * @returns {Object} New SagaState
 */
export function applyDelta(state, delta) {
    if (!delta || !delta.changes) return state;

    // Shallow clone top level
    const next = {
        ...state,
        canon: { ...state.canon, divergences: [...(state.canon.divergences || [])] },
        scene: { ...state.scene, presentCharacters: [...(state.scene.presentCharacters || [])], nearbyCharacters: [...(state.scene.nearbyCharacters || [])] },
        continuityConfig: { ...(state.continuityConfig || {}) },
        characters: [...(state.characters || [])],
        inventory: [...(state.inventory || [])],
        objectives: [...(state.objectives || [])],
        knowledge: { ...state.knowledge },
        secrets: [...(state.secrets || [])],
        relationships: [...(state.relationships || [])],
        threads: [...(state.threads || [])],
        continuityFlags: [...(state.continuityFlags || [])],
        storyMilestones: { ...(state.storyMilestones || {}) },
        lastDelta: delta,
    };

    const changes = delta.changes;

    // Canon block — shallow merge
    if (isSectionEnabled(next, 'canon') && changes.canon) {
        if (changes.canon.era !== undefined) next.canon.era = changes.canon.era;
        if (changes.canon.inUniverseDate !== undefined) next.canon.inUniverseDate = changes.canon.inUniverseDate;
        if (changes.canon.canonBoundary !== undefined) next.canon.canonBoundary = changes.canon.canonBoundary;
        if (Array.isArray(changes.canon.divergences)) {
            next.canon.divergences = changes.canon.divergences;
        }
    }

    // Scene block — shallow merge
    if (isSectionEnabled(next, 'scene') && changes.scene) {
        if (changes.scene.location !== undefined) next.scene.location = changes.scene.location;
        if (changes.scene.timeOfDay !== undefined) next.scene.timeOfDay = changes.scene.timeOfDay;
        if (isSectionEnabled(next, 'scene') && changes.scene.weather !== undefined) next.scene.weather = changes.scene.weather;
        if (isSectionEnabled(next, 'scene') && changes.scene.ambience !== undefined) next.scene.ambience = changes.scene.ambience;
        if (Array.isArray(changes.scene.presentCharacters)) {
            next.scene.presentCharacters = changes.scene.presentCharacters;
        }
        if (Array.isArray(changes.scene.nearbyCharacters)) {
            next.scene.nearbyCharacters = changes.scene.nearbyCharacters;
        }
        if (changes.scene.currentActivity !== undefined) next.scene.currentActivity = changes.scene.currentActivity;
    }

    // Characters — add/update/remove by name or index
    if (isSectionEnabled(next, 'characters') && changes.characters) {
        applyArrayDelta(next.characters, sanitizeCharacterPatchForConfig(changes.characters, next), 'name', normalizeCharacter);
    }

    // Inventory — add/update/remove by index
    if (isSectionEnabled(next, 'inventory') && changes.inventory) {
        applyArrayDelta(next.inventory, changes.inventory, 'item', normalizeInventoryItem);
    }

    // Objectives — add/update/remove by index
    if (isSectionEnabled(next, 'objectives') && changes.objectives) {
        applyArrayDelta(next.objectives, changes.objectives, 'goal', normalizeObjective);
    }

    // Knowledge — character-keyed, merge arrays per character
    if (isSectionEnabled(next, 'knowledge') && changes.knowledge) {
        for (const [char, facts] of Object.entries(changes.knowledge)) {
            if (!Array.isArray(facts)) continue;
            const existing = next.knowledge[char] || [];
            const merged = [...existing];
            for (const fact of facts) {
                if (!merged.includes(fact)) merged.push(fact);
            }
            next.knowledge[char] = merged;
        }
    }

    // Secrets — add/update/remove pattern
    if (isSectionEnabled(next, 'secrets') && changes.secrets) {
        if (Array.isArray(changes.secrets.added)) {
            next.secrets.push(...changes.secrets.added);
        }
        if (Array.isArray(changes.secrets.updated)) {
            for (const upd of changes.secrets.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets[idx] = { ...next.secrets[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.secrets.removed)) {
            const sorted = [...changes.secrets.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.secrets.length) {
                    next.secrets.splice(idx, 1);
                }
            }
        }
    }

    // Relationships — add/update/remove pattern
    if (isSectionEnabled(next, 'relationships') && changes.relationships) {
        if (Array.isArray(changes.relationships.added)) {
            next.relationships.push(...changes.relationships.added);
        }
        if (Array.isArray(changes.relationships.updated)) {
            for (const upd of changes.relationships.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships[idx] = { ...next.relationships[idx], ...upd.changes };
                }
            }
        }
        if (Array.isArray(changes.relationships.removed)) {
            const sorted = [...changes.relationships.removed].sort((a, b) => b - a);
            for (const idx of sorted) {
                if (idx >= 0 && idx < next.relationships.length) {
                    next.relationships.splice(idx, 1);
                }
            }
        }
    }

    // Threads — add/update pattern (no removal — threads resolve, not delete)
    if (isSectionEnabled(next, 'threads') && changes.threads) {
        if (Array.isArray(changes.threads.added)) {
            next.threads.push(...changes.threads.added);
        }
        if (Array.isArray(changes.threads.updated)) {
            for (const upd of changes.threads.updated) {
                const idx = upd.index;
                if (idx >= 0 && idx < next.threads.length) {
                    next.threads[idx] = { ...next.threads[idx], ...upd.changes };
                }
            }
        }
    }

    // Continuity flags — add/resolve pattern
    if (isSectionEnabled(next, 'flags') && changes.continuityFlags) {
        if (Array.isArray(changes.continuityFlags.added)) {
            next.continuityFlags.push(...changes.continuityFlags.added);
        }
        if (Array.isArray(changes.continuityFlags.resolved)) {
            next.continuityFlags = next.continuityFlags.filter(
                (_, i) => !changes.continuityFlags.resolved.includes(i)
            );
        }
    }

    if (isSectionEnabled(next, 'storyMilestones') && changes.storyMilestones && typeof changes.storyMilestones === 'object' && !Array.isArray(changes.storyMilestones)) {
        next.storyMilestones = { ...(next.storyMilestones || {}) };
        for (const [id, raw] of Object.entries(changes.storyMilestones)) {
            next.storyMilestones[id] = normalizeStoryMilestone({ ...(next.storyMilestones[id] || {}), ...(raw || {}) });
        }
    }

    return next;
}

// ── Entry normalizers (defensive — prevent malformed imports from crashing memo builder) ──

/**
 * Normalizes a secret entry to its canonical shape.
 * If whoKnows/whoSuspects are strings instead of arrays, wraps them.
 * @param {*} s - Raw secret entry
 * @returns {Object} Normalized secret
 */
function normalizeSecret(s) {
    return {
        fact: typeof s?.fact === 'string' ? s.fact : '',
        trueState: typeof s?.trueState === 'string' ? s.trueState : '',
        whoKnows: Array.isArray(s?.whoKnows) ? s.whoKnows.filter(x => typeof x === 'string') : [],
        whoSuspects: Array.isArray(s?.whoSuspects) ? s.whoSuspects.filter(x => typeof x === 'string') : [],
        publicVersion: typeof s?.publicVersion === 'string' ? s.publicVersion : '',
    };
}

/**
 * Normalizes a relationship entry to its canonical shape.
 * @param {*} r - Raw relationship entry
 * @returns {Object} Normalized relationship
 */
function normalizeRelationship(r) {
    return {
        pair: typeof r?.pair === 'string' ? r.pair : '',
        notes: typeof r?.notes === 'string' ? r.notes : '',
        tension: (r?.tension && VALID_ENUMS.tension.has(r.tension)) ? r.tension : '',
        trust: (r?.trust && VALID_ENUMS.trust.has(r.trust)) ? r.trust : '',
    };
}

/**
 * Normalizes a thread entry to its canonical shape.
 * @param {*} t - Raw thread entry
 * @returns {Object} Normalized thread
 */
function normalizeThread(t) {
    return {
        description: typeof t?.description === 'string' ? t.description : '',
        status: (t?.status && VALID_ENUMS.threadStatus.has(t.status)) ? t.status : 'active',
        unresolvedConsequences: Array.isArray(t?.unresolvedConsequences)
            ? t.unresolvedConsequences.filter(x => typeof x === 'string') : [],
    };
}

/**
 * Normalizes a continuity flag entry to its canonical shape.
 * @param {*} f - Raw flag entry
 * @returns {Object} Normalized flag
 */
function normalizeFlag(f) {
    return {
        type: (f?.type && VALID_ENUMS.flagType.has(f.type)) ? f.type : 'warning',
        description: typeof f?.description === 'string' ? f.description : '',
        severity: (f?.severity && VALID_ENUMS.flagSeverity.has(f.severity)) ? f.severity : 'low',
        timestamp: Number.isFinite(f?.timestamp) ? f.timestamp : Date.now(),
        resolved: typeof f?.resolved === 'boolean' ? f.resolved : false,
    };
}

/**
 * Normalizes all arrays in a state object (secrets, relationships, threads, flags).
 * Mutates the state in place.
 * @param {Object} state - SagaState to normalize
 */
function normalizeStateEntries(state) {
    if (Array.isArray(state.characters)) {
        state.characters = state.characters.map(normalizeCharacter).filter(c => c.name);
    } else {
        state.characters = [];
    }
    if (Array.isArray(state.inventory)) {
        state.inventory = state.inventory.map(normalizeInventoryItem).filter(i => i.item || i.owner || i.status);
    } else {
        state.inventory = [];
    }
    if (Array.isArray(state.objectives)) {
        state.objectives = state.objectives.map(normalizeObjective).filter(o => o.goal || o.owner);
    } else {
        state.objectives = [];
    }
    if (Array.isArray(state.secrets)) {
        state.secrets = state.secrets.map(normalizeSecret);
    }
    if (Array.isArray(state.relationships)) {
        state.relationships = state.relationships.map(normalizeRelationship);
    }
    if (Array.isArray(state.threads)) {
        state.threads = state.threads.map(normalizeThread);
    }
    if (Array.isArray(state.continuityFlags)) {
        state.continuityFlags = state.continuityFlags.map(normalizeFlag);
    }
    // Also normalize knowledge values: ensure each char has an array of strings
    if (state.knowledge && typeof state.knowledge === 'object' && !Array.isArray(state.knowledge)) {
        for (const [char, facts] of Object.entries(state.knowledge)) {
            if (!Array.isArray(facts)) {
                state.knowledge[char] = typeof facts === 'string' ? [facts] : [];
            } else {
                state.knowledge[char] = facts.filter(x => typeof x === 'string');
            }
        }
    }
}

// ── State import (validated) ────────────────────────────────────────────────────

/**
 * Imports state from a JSON string with validation and migration.
 * Always merges with defaults to fill missing fields.
 * @param {string} json - JSON string representing a SagaState
 * @returns {{ state: Object|null, error: string|null }}
 */
export function importState(json) {
    try {
        const parsed = JSON.parse(json);
        if (!parsed || typeof parsed !== 'object') {
            return { state: null, error: 'Imported JSON must be an object' };
        }
        if (Array.isArray(parsed)) {
            return { state: null, error: 'Imported JSON must be an object, not an array' };
        }

        // Merge with defaults to fill missing fields safely
        const defaults = getDefaultState();
        const merged = {
            ...defaults,
            ...parsed,
            canon: { ...defaults.canon, ...(parsed.canon || {}) },
            scene: { ...defaults.scene, ...(parsed.scene || {}) },
            continuityConfig: { ...defaults.continuityConfig, ...(parsed.continuityConfig || {}) },
            characters: Array.isArray(parsed.characters) ? parsed.characters : [],
            inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
            objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
            knowledge: parsed.knowledge && typeof parsed.knowledge === 'object' && !Array.isArray(parsed.knowledge)
                ? parsed.knowledge : {},
            secrets: Array.isArray(parsed.secrets) ? parsed.secrets : [],
            relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
            threads: Array.isArray(parsed.threads) ? parsed.threads : [],
            continuityFlags: Array.isArray(parsed.continuityFlags) ? parsed.continuityFlags : [],
            lastDelta: parsed.lastDelta || null,
            _version: SCHEMA_VERSION,

            // Lore fields (schema v2)
            loreContext: normalizeLoreContext(parsed.loreContext || {}),
            contextBrief: normalizeContextBrief(parsed.contextBrief || {}, parsed.loreContext || {}),
            loreMatrix: normalizeLoreMatrix(parsed.loreMatrix || []),
            pendingLoreEntries: normalizeLoreMatrix(parsed.pendingLoreEntries || []),

            // Lore generation lifecycle ledger (schema v3)
            loreGeneration: parsed.loreGeneration && typeof parsed.loreGeneration === 'object' && !Array.isArray(parsed.loreGeneration)
                ? {
                    lastAttemptedFor: parsed.loreGeneration.lastAttemptedFor || '',
                    lastProposedFor: parsed.loreGeneration.lastProposedFor || '',
                    lastAcceptedFor: parsed.loreGeneration.lastAcceptedFor || '',
                    lastRejectedFor: parsed.loreGeneration.lastRejectedFor || '',
                    lastFailedFor: parsed.loreGeneration.lastFailedFor || '',
                    attempts: parsed.loreGeneration.attempts && typeof parsed.loreGeneration.attempts === 'object' && !Array.isArray(parsed.loreGeneration.attempts)
                        ? parsed.loreGeneration.attempts : {},
                }
                : { ...getDefaultState().loreGeneration },

            loreBulkGeneration: parsed.loreBulkGeneration && typeof parsed.loreBulkGeneration === 'object' && !Array.isArray(parsed.loreBulkGeneration)
                ? {
                    activeBatchId: parsed.loreBulkGeneration.activeBatchId || '',
                    lastBatchId: parsed.loreBulkGeneration.lastBatchId || '',
                    batches: parsed.loreBulkGeneration.batches && typeof parsed.loreBulkGeneration.batches === 'object' && !Array.isArray(parsed.loreBulkGeneration.batches)
                        ? parsed.loreBulkGeneration.batches : {},
                    chunks: parsed.loreBulkGeneration.chunks && typeof parsed.loreBulkGeneration.chunks === 'object' && !Array.isArray(parsed.loreBulkGeneration.chunks)
                        ? parsed.loreBulkGeneration.chunks : {},
                    candidates: parsed.loreBulkGeneration.candidates && typeof parsed.loreBulkGeneration.candidates === 'object' && !Array.isArray(parsed.loreBulkGeneration.candidates)
                        ? parsed.loreBulkGeneration.candidates : {},
                }
                : { ...getDefaultState().loreBulkGeneration },

            loredeckCreator: normalizeLoredeckCreatorRegistry(parsed.loredeckCreator || getDefaultState().loredeckCreator),

            continuityScan: parsed.continuityScan && typeof parsed.continuityScan === 'object' && !Array.isArray(parsed.continuityScan)
                ? {
                    activeBatchId: parsed.continuityScan.activeBatchId || '',
                    lastBatchId: parsed.continuityScan.lastBatchId || '',
                    batches: parsed.continuityScan.batches && typeof parsed.continuityScan.batches === 'object' && !Array.isArray(parsed.continuityScan.batches)
                        ? parsed.continuityScan.batches : {},
                    chunks: parsed.continuityScan.chunks && typeof parsed.continuityScan.chunks === 'object' && !Array.isArray(parsed.continuityScan.chunks)
                        ? parsed.continuityScan.chunks : {},
                    observations: parsed.continuityScan.observations && typeof parsed.continuityScan.observations === 'object' && !Array.isArray(parsed.continuityScan.observations)
                        ? parsed.continuityScan.observations : {},
                }
                : { ...getDefaultState().continuityScan },

            pendingLoreMeta: parsed.pendingLoreMeta && typeof parsed.pendingLoreMeta === 'object' && !Array.isArray(parsed.pendingLoreMeta)
                ? parsed.pendingLoreMeta : null,
        };

        // Normalize all array entries to prevent malformed imports from crashing memo builder
        normalizeStateEntries(merged);

        // Re-migrate to ensure current schema
        const migrated = migrateState(merged);
        return { state: migrated, error: null };
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to import state:`, e);
        return { state: null, error: `JSON parse failed: ${e.message}` };
    }
}

/**
 * Serializes state to a pretty-printed JSON string.
 * @param {Object} state - SagaState
 * @returns {string} JSON string
 */
export function exportState(state) {
    try {
        return JSON.stringify(stripRetiredStateHistoryFields({ ...(state || {}) }), null, 2);
    } catch (e) {
        console.error(`${LOG_PREFIX} Failed to export state:`, e);
        return '{}';
    }
}

// ── Lore-specific state operations ──────────────────────────────────────────────

/**
 * Updates loreContext on the live state object and persists.
 * Used after lore context detection completes.
 * @param {Object} contextUpdate - Partial lore context to merge
 * @returns {Object} Updated state (the live object, not a clone)
 */
/**
 * If the candidate is a non-blank string, return it; otherwise keep the fallback.
 * Prevents an empty detection result from overwriting a known context value.
 * @param {*} candidate - The detected value (may be empty string, null, undefined)
 * @param {string} fallback - The previous known value
 * @returns {string}
 */
function keepIfBlank(candidate, fallback) {
    return typeof candidate === 'string' && candidate.trim()
        ? candidate.trim()
        : (fallback || '');
}

/**
 * Updates loreContext on the live state object and persists.
 * Used after lore context detection completes.
 *
 * Empty-string detector results are treated as "unknown" and do NOT overwrite
 * previously known context. Only non-blank values replace existing fields.
 *
 * @param {Object} contextUpdate - Partial lore context to merge
 * @returns {Object} Updated state (the live object, not a clone)
 */
export function setLoreContext(contextUpdate) {
    const state = getState();
    const previous = state.loreContext || {};

    // Only allow detection to update actual context fields, never metadata.
    // normalizeLoreContext fills missing fields with empty strings,
    // so spreading it unconditionally would clear lastGeneratedFor/lastGenerationSummary.
    state.loreContext = normalizeLoreContext({
        ...previous,
        sceneDate: keepIfBlank(contextUpdate?.sceneDate, previous.sceneDate),
        subjectiveDate: keepIfBlank(contextUpdate?.subjectiveDate, previous.subjectiveDate),
        canonBoundary: keepIfBlank(contextUpdate?.canonBoundary, previous.canonBoundary),
        branchId: keepIfBlank(contextUpdate?.branchId, previous.branchId || 'main'),
        timeTravelMode: keepIfBlank(contextUpdate?.timeTravelMode, previous.timeTravelMode || 'none'),
        lastDetectedAt: Date.now(),
        lastGeneratedFor: previous.lastGeneratedFor || '',
        lastGenerationSummary: previous.lastGenerationSummary || '',
    });

    saveState(state);
    return state;
}

// ── Lore generation lifecycle ledger ────────────────────────────────────────────

/**
 * Records a lore generation attempt in the ledger.
 * Does NOT mark the context as proposed — just logs the attempt.
 * Safe to call even if loreGeneration doesn't exist yet (initializes on demand).
 *
 * The attemptCount only increments when options.increment is true (default).
 * Pass { increment: false } for status updates that follow an already-counted
 * attempt (e.g. recording a failure for an attempt that was already started),
 * so a single real generation attempt is not counted multiple times.
 *
 * When the patched status is a failure ('failed_*') or 'empty', the top-level
 * loreGeneration.lastFailedFor is updated to this context key.
 *
 * @param {string} contextKey - The current lore generation key
 * @param {Object} [patch={}] - Additional fields to merge into the attempt record
 * @param {Object} [options={}] - { increment?: boolean } — whether to bump attemptCount
 * @returns {Object} Updated state
 */
export function setContextBrief(briefUpdate, options = {}) {
    const state = getState();
    state.contextBrief = normalizeContextBrief(briefUpdate || {}, state.loreContext || {});
    if (options.save !== false) saveState(state);
    return state;
}

export function getLoredeckContext(state = getState(), packId = '') {
    const id = cleanContextString(packId, 120);
    if (!id) return normalizeLoredeckContext(null, '', state?.loreContext || {});
    const contexts = normalizeLoredeckContexts(state?.loredeckContexts || {}, state || {});
    return contexts[id] || normalizeLoredeckContext(null, id, state?.loreContext || {});
}

export function setLoredeckContext(packId, patch = {}) {
    const id = cleanContextString(packId, 120);
    if (!id) return getState();
    const state = getState();
    state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
    const previous = state.loredeckContexts[id] || normalizeLoredeckContext(null, id, state.loreContext || {});
    state.loredeckContexts[id] = normalizeLoredeckContext({
        ...previous,
        ...(patch || {}),
        packId: id,
        updatedAt: Number.isFinite(Number(patch?.updatedAt)) ? Number(patch.updatedAt) : Date.now(),
    }, id, state.loreContext || {});
    saveState(state);
    return state;
}

export function resetLoredeckContext(packId) {
    const id = cleanContextString(packId, 120);
    if (!id) return getState();
    const state = getState();
    state.loredeckContexts = normalizeLoredeckContexts(state.loredeckContexts, state);
    state.loredeckContexts[id] = normalizeLoredeckContext(null, id, {});
    state.loredeckContexts[id].updatedAt = Date.now();
    saveState(state);
    return state;
}

export function recordLoreAttempt(contextKey, patch = {}, options = {}) {
    const { increment = true, syncPrompt = true } = options;
    const state = getState();

    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }

    const previous = state.loreGeneration.attempts[contextKey] || {
        attemptCount: 0,
    };

    state.loreGeneration.attempts[contextKey] = {
        ...previous,
        ...patch,
        attemptCount: previous.attemptCount + (increment ? 1 : 0),
        lastAttemptAt: increment ? Date.now() : previous.lastAttemptAt,
        lastUpdatedAt: Date.now(),
    };

    if (increment) {
        state.loreGeneration.lastAttemptedFor = contextKey;
    }

    // Track the most recent failed/empty context at the top level
    const status = String(patch.status || '');
    if (status.startsWith('failed') || status === 'empty') {
        state.loreGeneration.lastFailedFor = contextKey;
    }

    saveState(state, { syncPrompt });
    return state;
}

function ensureLoreBulkGenerationLedger(state = getState()) {
    if (!state.loreBulkGeneration || typeof state.loreBulkGeneration !== 'object' || Array.isArray(state.loreBulkGeneration)) {
        state.loreBulkGeneration = getDefaultState().loreBulkGeneration;
    }
    for (const key of ['batches', 'chunks', 'candidates']) {
        if (!state.loreBulkGeneration[key] || typeof state.loreBulkGeneration[key] !== 'object' || Array.isArray(state.loreBulkGeneration[key])) {
            state.loreBulkGeneration[key] = {};
        }
    }
    state.loreBulkGeneration.activeBatchId = String(state.loreBulkGeneration.activeBatchId || '');
    state.loreBulkGeneration.lastBatchId = String(state.loreBulkGeneration.lastBatchId || '');
    return state.loreBulkGeneration;
}

function compactBulkCandidateFact(raw = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const messageRefs = Array.isArray(raw.messageRefs) ? raw.messageRefs : [];
    return {
        category: truncateText(raw.category || 'knowledge', 60),
        subject: truncateText(raw.subject || 'Story fact', 160),
        fact: truncateText(raw.fact || raw.text || raw.description || '', 900),
        priorityHint: truncateText(raw.priorityHint || raw.priority || 'medium', 40),
        confidence: Number.isFinite(Number(raw.confidence)) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0.75,
        messageRefs: messageRefs.map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0).slice(0, 20),
        scope: raw.scope && typeof raw.scope === 'object' ? raw.scope : {},
        evidence: truncateText(raw.evidence || '', 400),
        chunkId: truncateText(raw.chunkId || '', 180),
        startIndex: Number.isFinite(Number(raw.startIndex)) ? Number(raw.startIndex) : 0,
        endIndex: Number.isFinite(Number(raw.endIndex)) ? Number(raw.endIndex) : 0,
    };
}

function compactBulkCandidates(candidates = [], limit = 80) {
    const raw = Array.isArray(candidates) ? candidates : [];
    return raw.slice(0, Math.max(0, Number(limit) || 80)).map(compactBulkCandidateFact).filter(Boolean);
}

function compactBulkLedger(state, options = {}) {
    const ledger = ensureLoreBulkGenerationLedger(state);
    const retainCompletedBatches = Math.max(1, Number(options.retainCompletedBatches) || Number(getSettings().loreBulkRetainCompletedBatches) || 3);
    const batchEntries = Object.entries(ledger.batches || {}).sort((a, b) => Number(b[1]?.updatedAt || b[1]?.createdAt || 0) - Number(a[1]?.updatedAt || a[1]?.createdAt || 0));
    const keepBatchIds = new Set();
    let completedKept = 0;
    for (const [id, batch] of batchEntries) {
        const status = String(batch?.status || '');
        if (id === ledger.activeBatchId || status === 'running' || status === 'queued' || status === 'partial' || status === 'failed') {
            keepBatchIds.add(id);
        } else if (completedKept < retainCompletedBatches) {
            keepBatchIds.add(id);
            completedKept++;
        }
    }
    if (ledger.lastBatchId) keepBatchIds.add(ledger.lastBatchId);

    for (const id of Object.keys(ledger.batches || {})) {
        if (!keepBatchIds.has(id)) delete ledger.batches[id];
    }
    for (const [chunkId, chunk] of Object.entries(ledger.chunks || {})) {
        if (chunk?.batchId && !keepBatchIds.has(chunk.batchId)) delete ledger.chunks[chunkId];
    }
    for (const [chunkId, record] of Object.entries(ledger.candidates || {})) {
        if (record?.batchId && !keepBatchIds.has(record.batchId)) delete ledger.candidates[chunkId];
    }
    return ledger;
}

function saveBulkLedgerState(state, options = {}) {
    const { full = false, syncPrompt = false } = options || {};
    if (full) {
        compactBulkLedger(state, options);
    }
    saveState(state, { syncPrompt, sanitize: full });
}

/**
 * Creates or updates a resumable bulk lore scan batch.
 * Batch creation is an immediate durable checkpoint, but it deliberately does
 * not queue prompt-injection sync because pending/accepted lore has not changed.
 * @param {Object} batch - Batch metadata. Must include id.
 * @returns {Object} Updated state
 */
export function startLoreBulkBatch(batch = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batch.id || `lore_bulk_${Date.now()}`);
    const previous = ledger.batches[id] || {};
    ledger.batches[id] = {
        ...previous,
        ...batch,
        id,
        status: batch.status || 'running',
        createdAt: previous.createdAt || Date.now(),
        updatedAt: Date.now(),
        startedAt: batch.startedAt || previous.startedAt || Date.now(),
        lastFullCheckpointAt: previous.lastFullCheckpointAt || 0,
        lastFullCheckpointChunkCount: previous.lastFullCheckpointChunkCount || 0,
    };
    ledger.activeBatchId = id;
    ledger.lastBatchId = id;
    saveBulkLedgerState(state, { full: true, syncPrompt: false });
    return state;
}

/**
 * Patches a bulk lore scan batch.
 * @param {string} batchId - Batch id
 * @param {Object} patch - Fields to merge
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function updateLoreBulkBatch(batchId, patch = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batchId || ledger.activeBatchId || ledger.lastBatchId || '');
    if (!id) return state;
    const previous = ledger.batches[id] || { id, createdAt: Date.now() };
    ledger.batches[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
    };
    if (patch.status && !['running', 'queued'].includes(String(patch.status))) {
        if (ledger.activeBatchId === id) ledger.activeBatchId = '';
    }
    saveBulkLedgerState(state, { full: options.full !== false, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Patches a single chunk in the bulk lore scan ledger.
 * @param {string} chunkId - Stable chunk id
 * @param {Object} patch - Fields to merge
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function updateLoreBulkChunk(chunkId, patch = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || '');
    if (!id) return state;
    const previous = ledger.chunks[id] || { id, attempts: 0, createdAt: Date.now() };
    ledger.chunks[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
    };
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Stores compact candidate facts for a completed bulk lore chunk.
 * @param {string} batchId - Batch id
 * @param {string} chunkId - Chunk id
 * @param {Object[]} candidates - Candidate fact objects
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function storeLoreBulkCandidates(batchId, chunkId, candidates = [], options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || '');
    if (!id) return state;
    ledger.candidates[id] = {
        batchId: String(batchId || ''),
        chunkId: id,
        candidates: compactBulkCandidates(candidates, options.maxCandidates || 80),
        updatedAt: Date.now(),
    };
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Writes a single durable bulk-scan checkpoint. This is the primary write-ahead
 * log primitive for large scans: one small, prompt-sync-free save records chunk
 * status, optional candidates, and optional batch counters.
 * @param {string} chunkId - Stable chunk id
 * @param {Object} payload - { batchId, chunkPatch, candidates, batchPatch, rawResponse }
 * @param {Object} [options] - { full?: boolean, syncPrompt?: boolean }
 * @returns {Object} Updated state
 */
export function checkpointLoreBulkChunk(chunkId, payload = {}, options = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(chunkId || payload.chunkId || '');
    if (!id) return state;
    const batchId = String(payload.batchId || payload.chunkPatch?.batchId || payload.batchPatch?.id || ledger.activeBatchId || ledger.lastBatchId || '');
    const previous = ledger.chunks[id] || { id, attempts: 0, createdAt: Date.now() };
    const rawResponse = payload.rawResponse && getSettings().loreBulkRetainRawResponses ? truncateText(payload.rawResponse, 20000) : '';
    ledger.chunks[id] = {
        ...previous,
        ...(payload.chunkPatch || {}),
        id,
        batchId: batchId || previous.batchId || '',
        rawResponse,
        updatedAt: Date.now(),
    };
    if (Array.isArray(payload.candidates)) {
        ledger.candidates[id] = {
            batchId,
            chunkId: id,
            candidates: compactBulkCandidates(payload.candidates, payload.maxCandidates || 80),
            updatedAt: Date.now(),
        };
    }
    if (batchId && payload.batchPatch && typeof payload.batchPatch === 'object') {
        const batchPrevious = ledger.batches[batchId] || { id: batchId, createdAt: Date.now() };
        ledger.batches[batchId] = {
            ...batchPrevious,
            ...payload.batchPatch,
            id: batchId,
            updatedAt: Date.now(),
        };
        if (payload.batchPatch.status && !['running', 'queued'].includes(String(payload.batchPatch.status))) {
            if (ledger.activeBatchId === batchId) ledger.activeBatchId = '';
        }
    }
    saveBulkLedgerState(state, { full: !!options.full, syncPrompt: !!options.syncPrompt });
    return state;
}

/**
 * Marks stale in-flight chunks as interrupted so resuming scans can distinguish
 * abandoned work from currently running work.
 * @param {number} [staleMs] - Running/retrying chunks older than this are interrupted
 * @returns {Object} Updated state
 */
export function markInterruptedLoreBulkChunks(staleMs = 10 * 60 * 1000) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const cutoff = Date.now() - Math.max(1000, Number(staleMs) || 600000);
    let changed = false;
    for (const [id, chunk] of Object.entries(ledger.chunks || {})) {
        const status = String(chunk?.status || '');
        const updatedAt = Number(chunk?.updatedAt || chunk?.startedAt || chunk?.lastScannedAt || 0);
        if ((status === 'running' || status === 'retrying') && (!updatedAt || updatedAt < cutoff)) {
            ledger.chunks[id] = {
                ...chunk,
                status: 'interrupted',
                error: chunk?.error || 'Previous scan was interrupted before this chunk completed.',
                updatedAt: Date.now(),
            };
            changed = true;
        }
    }
    if (changed) saveBulkLedgerState(state, { full: false, syncPrompt: false });
    return state;
}

/**
 * Forces a full bulk ledger checkpoint after a batch of lightweight chunk writes.
 * @param {string} batchId - Batch id
 * @param {Object} [patch] - Optional batch patch
 * @returns {Object} Updated state
 */
export function flushLoreBulkFullCheckpoint(batchId, patch = {}) {
    const state = getState();
    const ledger = ensureLoreBulkGenerationLedger(state);
    const id = String(batchId || ledger.activeBatchId || ledger.lastBatchId || '');
    if (!id) return state;
    const previous = ledger.batches[id] || { id, createdAt: Date.now() };
    ledger.batches[id] = {
        ...previous,
        ...patch,
        id,
        updatedAt: Date.now(),
        lastFullCheckpointAt: Date.now(),
        lastFullCheckpointChunkCount: Number(patch.completedChunks ?? previous.completedChunks ?? 0) + Number(patch.failedChunks ?? previous.failedChunks ?? 0),
    };
    if (patch.status && !['running', 'queued'].includes(String(patch.status))) {
        if (ledger.activeBatchId === id) ledger.activeBatchId = '';
    }
    saveBulkLedgerState(state, { full: true, syncPrompt: false });
    return state;
}

/**
 * Appends generated lore into Pending Lore Review without replacing existing pending entries.
 * Used by bulk lore scans so successful chunks commit partial progress immediately.
 * @param {Object[]} entries - Raw lore entries to append/merge
 * @param {Object} meta - Pending/batch metadata
 * @param {Object} options - { syncPrompt?: boolean, full?: boolean }
 * @returns {{ state: Object, changed: boolean, appendedCount: number, pendingCount: number }}
 */
export function appendPendingLoreEntries(entries, meta = {}, options = {}) {
    const { syncPrompt = true, full = true } = options;
    const state = getState();
    const settings = getSettings();
    const incoming = preprocessPendingLoreEntries(entries || [], state, settings);
    if (incoming.length === 0) {
        return { state, changed: false, appendedCount: 0, pendingCount: (state.pendingLoreEntries || []).length };
    }

    const before = normalizeLoreMatrix(state.pendingLoreEntries || []);
    const merged = mergeLoreEntries(before, incoming);
    state.pendingLoreEntries = merged;

    const contextKey = meta.contextKey || state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const oldMeta = state.pendingLoreMeta && typeof state.pendingLoreMeta === 'object' ? state.pendingLoreMeta : {};
    const rawEntryCount = Math.max(0, Number(oldMeta.rawEntryCount) || 0) + Math.max(0, Number(meta.rawEntryCount ?? incoming.length) || incoming.length);
    const normalizedEntryCount = Math.max(0, Number(oldMeta.normalizedEntryCount) || 0) + Math.max(0, Number(meta.normalizedEntryCount ?? incoming.length) || incoming.length);
    const duplicateCount = Math.max(0, Number(oldMeta.droppedDuplicateCount) || 0) + Math.max(0, Number(meta.droppedDuplicateCount) || 0);
    const qualityCount = Math.max(0, Number(oldMeta.droppedQualityCount) || 0) + Math.max(0, Number(meta.droppedQualityCount) || 0);
    const routedSimilarCount = Math.max(0, Number(oldMeta.routedSimilarCount) || 0) + Math.max(0, Number(meta.routedSimilarCount) || 0);
    const failedChunkCount = Math.max(0, Number(meta.failedChunkCount ?? oldMeta.failedChunkCount) || 0);
    const completedChunkCount = Math.max(0, Number(meta.completedChunkCount ?? oldMeta.completedChunkCount) || 0);
    const chunkCount = Math.max(0, Number(meta.chunkCount ?? oldMeta.chunkCount) || 0);

    state.pendingLoreMeta = {
        ...oldMeta,
        id: oldMeta.id || meta.id || `lore_batch_${Date.now()}`,
        contextKey,
        source: meta.source || oldMeta.source || 'manual_bulk',
        status: 'pending',
        createdAt: oldMeta.createdAt || Date.now(),
        updatedAt: Date.now(),
        summary: meta.summary || oldMeta.summary || '',
        rawEntryCount,
        normalizedEntryCount,
        validEntryCount: merged.length,
        droppedEntryCount: Math.max(0, rawEntryCount - merged.length),
        droppedDuplicateCount: duplicateCount,
        droppedQualityCount: qualityCount,
        routedSimilarCount,
        failedChunkCount,
        emptyChunkCount: Math.max(0, Number(meta.emptyChunkCount ?? oldMeta.emptyChunkCount) || 0),
        chunkCount,
        completedChunkCount,
        sourceMessageCount: Math.max(0, Number(meta.sourceMessageCount ?? oldMeta.sourceMessageCount) || 0),
        chunkSize: Math.max(0, Number(meta.chunkSize ?? oldMeta.chunkSize) || 0),
        generationMode: meta.generationMode || oldMeta.generationMode || '',
        generationConfiguredMode: meta.generationConfiguredMode || oldMeta.generationConfiguredMode || '',
        targetEntryCount: Math.max(0, Number(meta.targetEntryCount ?? oldMeta.targetEntryCount) || 0),
        storyLoreCountBefore: Math.max(0, Number(meta.storyLoreCountBefore ?? oldMeta.storyLoreCountBefore) || 0),
        bulkBatchId: meta.bulkBatchId || oldMeta.bulkBatchId || '',
        bulkChunkId: meta.bulkChunkId || oldMeta.bulkChunkId || '',
        bulk: meta.bulk === undefined ? (oldMeta.bulk || false) : !!meta.bulk,
    };

    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastProposedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'pending',
        lastProposedAt: Date.now(),
        validEntryCount: merged.length,
        rawEntryCount,
        normalizedEntryCount,
        droppedDuplicateCount: duplicateCount,
        droppedQualityCount: qualityCount,
        routedSimilarCount,
        generationMode: state.pendingLoreMeta.generationMode,
        targetEntryCount: state.pendingLoreMeta.targetEntryCount,
        lastSource: state.pendingLoreMeta.source,
    };

    saveState(state, { syncPrompt, sanitize: full });
    return { state, changed: true, appendedCount: Math.max(0, merged.length - before.length), pendingCount: merged.length };
}


/**
 * Patches pending lore metadata without changing pending entries.
 * Used by bulk scans to update final chunk/duplicate diagnostics even when later chunks add no new entries.
 * @param {Object} patch - Metadata fields to merge
 * @returns {Object} Updated state
 */
export function patchPendingLoreMeta(patch = {}, options = {}) {
    const state = getState();
    if (!state.pendingLoreMeta || typeof state.pendingLoreMeta !== 'object') {
        return state;
    }
    state.pendingLoreMeta = {
        ...state.pendingLoreMeta,
        ...patch,
        updatedAt: Date.now(),
        validEntryCount: Array.isArray(state.pendingLoreEntries) ? state.pendingLoreEntries.length : 0,
    };
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: options.full !== false });
    return state;
}

/**
 * Marks the current pending lore batch as stale because the context changed.
 * Updates pendingLoreMeta.status to 'stale' and persists.
 *
 * @param {string} [reason=''] - Why the pending lore is stale
 * @returns {Object} Updated state
 */
export function markPendingLoreStale(reason = '') {
    const state = getState();

    if (state.pendingLoreMeta && state.pendingLoreEntries?.length > 0) {
        state.pendingLoreMeta.status = 'stale';
        state.pendingLoreMeta.staleAt = Date.now();
        state.pendingLoreMeta.staleReason = reason || 'Context changed';
        saveState(state);
    }

    return state;
}

/**
 * Marks the old pending lore batch's ledger entry as 'replaced' when a new
 * generation overwrites it for a different context. Keeps the ledger truthful
 * so an abandoned 'pending' entry is not left dangling.
 *
 * No-op when there is no old pending context, or when the old context equals
 * the incoming one (a re-generation for the same context).
 *
 * @param {string} newContextKey - The context key of the incoming proposal
 * @returns {Object} Updated state
 */
export function markPendingLoreReplaced(newContextKey) {
    const state = getState();

    const oldMeta = state.pendingLoreMeta;
    const oldKey = oldMeta?.contextKey || '';
    const oldBatchId = oldMeta?.id || '';

    if (!oldKey || !state.loreGeneration?.attempts) {
        return state;
    }

    const previousAttempt = state.loreGeneration.attempts[oldKey] || {};

    state.loreGeneration.attempts[oldKey] = {
        ...previousAttempt,
        status: 'replaced',
        replacedAt: Date.now(),
        replacedBy: newContextKey || '',
        replacedBatchId: oldBatchId,
    };

    saveState(state);
    return state;
}

function uniqueMergedStrings(...arrays) {
    const seen = new Set();
    const out = [];
    for (const array of arrays) {
        for (const raw of Array.isArray(array) ? array : []) {
            const text = String(raw || '').trim();
            if (!text) continue;
            const key = text.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(text);
        }
    }
    return out;
}

function preparePendingLoreEntryForAcceptance(pendingEntry, existingEntries = []) {
    const pending = normalizeLoreEntry(pendingEntry);
    const generation = pending.extensions?.sagaGeneration || {};
    const review = pending.extensions?.sagaPendingReview || {};
    const operation = String(generation.operation || review.reviewRoute || '').toLowerCase();
    const targetId = String(generation.targetEntryId || review.targetEntryId || '').trim();
    if (!targetId || !['update', 'merge', 'supersede', 'conflict', 'possible_update', 'possible_merge'].includes(operation)) return pending;

    const current = normalizeLoreMatrix(existingEntries).find(entry => entry.id === targetId);
    if (!current || current.locked) return pending;

    const mergeMode = operation === 'merge' || operation === 'possible_merge';
    const currentContent = current.content || {};
    const pendingContent = pending.content || {};
    const mergedFact = mergeMode && current.fact && pending.fact && !String(current.fact).includes(pending.fact)
        ? `${current.fact} ${pending.fact}`.trim()
        : (pending.fact || current.fact);
    const mergedInjection = mergeMode && currentContent.injection && pendingContent.injection && !String(currentContent.injection).includes(pendingContent.injection)
        ? `${currentContent.injection} ${pendingContent.injection}`.trim()
        : (pendingContent.injection || currentContent.injection || mergedFact);

    return normalizeLoreEntry({
        ...current,
        ...pending,
        id: current.id,
        title: mergeMode ? current.title : (pending.title || current.title),
        locked: current.locked,
        userEdited: current.userEdited || pending.userEdited,
        protected: current.protected || pending.protected,
        tags: uniqueMergedStrings(current.tags, pending.tags),
        scope: {
            ...(current.scope || {}),
            ...(pending.scope || {}),
            characters: uniqueMergedStrings(current.scope?.characters, pending.scope?.characters),
            locations: uniqueMergedStrings(current.scope?.locations, pending.scope?.locations),
            factions: uniqueMergedStrings(current.scope?.factions, pending.scope?.factions),
            topics: uniqueMergedStrings(current.scope?.topics, pending.scope?.topics),
            objects: uniqueMergedStrings(current.scope?.objects, pending.scope?.objects),
            spells: uniqueMergedStrings(current.scope?.spells, pending.scope?.spells),
            schoolYears: uniqueMergedStrings(current.scope?.schoolYears, pending.scope?.schoolYears),
            books: uniqueMergedStrings(current.scope?.books, pending.scope?.books),
            eras: uniqueMergedStrings(current.scope?.eras, pending.scope?.eras),
        },
        content: {
            ...currentContent,
            ...pendingContent,
            fact: mergedFact,
            injection: mergedInjection,
            constraints: uniqueMergedStrings(currentContent.constraints, pendingContent.constraints),
            antiLore: uniqueMergedStrings(currentContent.antiLore, pendingContent.antiLore),
            notes: [currentContent.notes, pendingContent.notes].filter(Boolean).join(' '),
        },
        extensions: {
            ...(current.extensions || {}),
            ...(pending.extensions || {}),
            sagaGeneration: {
                ...(pending.extensions?.sagaGeneration || {}),
                acceptedAsOperation: operation,
                acceptedTargetEntryId: current.id,
                acceptedAt: Date.now(),
            },
        },
    });
}

function applyAcceptedLoreSelectionRecommendations(state, entries = []) {
    if (!state.loreSelection || typeof state.loreSelection !== 'object') state.loreSelection = { pinnedIds: [], suppressedIds: [] };
    const pinSet = new Set(Array.isArray(state.loreSelection.pinnedIds) ? state.loreSelection.pinnedIds : []);
    const muteSet = new Set(Array.isArray(state.loreSelection.suppressedIds) ? state.loreSelection.suppressedIds : []);
    for (const entry of normalizeLoreMatrix(entries)) {
        const generation = entry.extensions?.sagaGeneration || {};
        if (generation.recommendedMute) {
            muteSet.add(entry.id);
            pinSet.delete(entry.id);
        } else if (generation.recommendedPin || entry.protected) {
            pinSet.add(entry.id);
        }
    }
    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(muteSet);
}


function getPendingLoreTimelineSource(meta = {}, entries = []) {
    const source = String(meta?.source || entries?.[0]?.source || entries?.[0]?.sourceInfo?.work || '').toLowerCase();
    if (source.includes('canon')) return 'canon_database';
    if (source.includes('timeline')) return 'timeline_recovery';
    if (source.includes('manual') || source.includes('user')) return 'manual';
    if (source.includes('story') || source.includes('generation') || source.includes('bulk')) return 'story_generation';
    return 'pending_review';
}

function recordAcceptedLoreTimelineMutation(state, before, type, source, summary) {
    const after = captureLoreTimelineState(state);
    recordLoreTimelineEvent(state, { before, after, type, source, summary });
}


/**
 * Accepts pending lore entries by merging them into loreMatrix.
 * Updates the generation ledger so the context is marked as accepted.
 * Locked/user-edited entries in the matrix are preserved.
 * @returns {Object} Updated state
 */
export function acceptPendingLoreEntries() {
    const settings = getSettings();
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []);
    const existing = normalizeLoreMatrix(state.loreMatrix || []);

    if (pending.length === 0) return state;

    const beforeTimeline = captureLoreTimelineState(state);
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const source = getPendingLoreTimelineSource(state.pendingLoreMeta, pending);

    const prepared = pending.map(entry => preparePendingLoreEntryForAcceptance(entry, existing));
    const merged = mergeLoreEntries(existing, prepared);

    // Accepted lore is intentionally uncapped. The Lore tab uses paged rendering
    // so large matrices stay usable without deleting lower-priority entries.
    state.loreMatrix = merged;
    applyAcceptedLoreSelectionRecommendations(state, prepared);
    state.pendingLoreEntries = [];
    state.pendingLoreMeta = null;

    if (state.loreContext) {
        state.loreContext.lastGenerationSummary = '';
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastAcceptedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'accepted',
        acceptedAt: Date.now(),
        validEntryCount: pending.length,
    };

    recordAcceptedLoreTimelineMutation(state, beforeTimeline, 'accept_pending', source, `Accepted ${pending.length} pending lore entr${pending.length === 1 ? 'y' : 'ies'}.`);
    saveState(state);
    return state;
}

/**
 * Rejects pending lore entries by clearing them without merging.
 * Updates the generation ledger so the context is marked as rejected
 * and auto-generation will not repeat it until context changes.
 * @returns {Object} Updated state
 */
export function rejectPendingLoreEntries() {
    const state = getState();
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);

    state.pendingLoreEntries = [];
    state.pendingLoreMeta = null;

    if (state.loreContext) {
        state.loreContext.lastGenerationSummary = '';
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastRejectedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: 'rejected',
        rejectedAt: Date.now(),
    };

    saveState(state);
    return state;
}

/**
 * Accepts a single pending lore entry by index, merging it into the lore matrix.
 * The remaining pending entries stay pending.
 * @param {number} entryIndex - Index into pendingLoreEntries array
 * @returns {{ state: Object, accepted: Object|null }} Updated state and the accepted entry
 */
export function acceptPendingLoreEntry(entryIndex) {
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []);
    const existing = normalizeLoreMatrix(state.loreMatrix || []);

    if (entryIndex < 0 || entryIndex >= pending.length || pending.length === 0) {
        return { state, accepted: null };
    }

    const beforeTimeline = captureLoreTimelineState(state);
    const acceptedEntry = preparePendingLoreEntryForAcceptance(pending[entryIndex], existing);
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);
    const source = getPendingLoreTimelineSource(state.pendingLoreMeta, [acceptedEntry]);

    // Merge the single entry into the uncapped lore matrix. UI paging handles scale.
    const merged = mergeLoreEntries(existing, [acceptedEntry]);

    state.loreMatrix = merged;
    applyAcceptedLoreSelectionRecommendations(state, [acceptedEntry]);

    // Remove the accepted entry from pending
    state.pendingLoreEntries = pending.filter((_, i) => i !== entryIndex);

    // If no more pending entries, clear the meta
    if (state.pendingLoreEntries.length === 0) {
        state.pendingLoreMeta = null;
        if (state.loreContext) {
            state.loreContext.lastGenerationSummary = '';
        }
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastAcceptedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: state.pendingLoreEntries.length === 0 ? 'accepted' : 'partial_accept',
        acceptedAt: Date.now(),
        acceptedEntryCount: (state.loreGeneration.attempts[contextKey]?.acceptedEntryCount || 0) + 1,
    };

    recordAcceptedLoreTimelineMutation(state, beforeTimeline, 'accept_pending_entry', source, `Accepted pending lore: ${acceptedEntry.title || acceptedEntry.id}.`);
    saveState(state);
    return { state, accepted: acceptedEntry };
}

/**
 * Rejects a single pending lore entry by index, removing it from pending.
 * The remaining pending entries stay pending.
 * @param {number} entryIndex - Index into pendingLoreEntries array
 * @returns {{ state: Object, rejected: Object|null }} Updated state and the rejected entry
 */
export function rejectPendingLoreEntry(entryIndex) {
    const state = getState();
    const pending = normalizeLoreMatrix(state.pendingLoreEntries || []);

    if (entryIndex < 0 || entryIndex >= pending.length || pending.length === 0) {
        return { state, rejected: null };
    }

    const rejectedEntry = pending[entryIndex];
    const contextKey = state.pendingLoreMeta?.contextKey || buildLoreGenerationKey(state);

    // Remove the rejected entry from pending
    state.pendingLoreEntries = pending.filter((_, i) => i !== entryIndex);

    // If no more pending entries, clear the meta
    if (state.pendingLoreEntries.length === 0) {
        state.pendingLoreMeta = null;
        if (state.loreContext) {
            state.loreContext.lastGenerationSummary = '';
        }
    }

    // Update generation ledger
    if (!state.loreGeneration || typeof state.loreGeneration !== 'object') {
        state.loreGeneration = getDefaultState().loreGeneration;
    }
    state.loreGeneration.lastRejectedFor = contextKey;
    state.loreGeneration.attempts[contextKey] = {
        ...(state.loreGeneration.attempts[contextKey] || {}),
        status: state.pendingLoreEntries.length === 0 ? 'rejected' : 'partial_reject',
        rejectedAt: Date.now(),
        rejectedEntryCount: (state.loreGeneration.attempts[contextKey]?.rejectedEntryCount || 0) + 1,
    };

    saveState(state);
    return { state, rejected: rejectedEntry };
}


// ── Utility: deep-merge defaults ────────────────────────────────────────────────

/**
 * Deep-merges default values into target for missing or invalid keys.
 * Returns target (mutated in place, but safe since these are schema-level objects).
 * @param {*} target - The existing value (may be undefined/null/non-object)
 * @param {Object} defaults - Default object to merge
 * @returns {Object} target with defaults filled in
 */
export function restoreLoreTimelineEntriesToPending(eventId, entryIds = null) {
    const state = getState();
    const result = restoreTimelineEntriesToPending(state, eventId, entryIds);
    if (result.restored > 0) saveState(state);
    return { state, ...result };
}

function mergeDefaults(target, defaults) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
        return { ...defaults };
    }
    const result = { ...target };
    for (const key of Object.keys(defaults)) {
        if (result[key] === undefined || result[key] === null) {
            result[key] = defaults[key];
        }
    }
    return result;
}

// ── Export the default state factory for convenience ────────────────────────────
export { getDefaultState };
