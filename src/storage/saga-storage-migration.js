/**
 * One-time migration from settings-backed Saga content to flat /user/files storage.
 */

import { DEFAULT_SETTINGS } from '../state/constants.js';
import { normalizeLoredeckCreatorRegistry } from '../state/lore-creator-state.js';
import { normalizeLoredeckRegistry } from '../state/lore-state-normalizers.js';
import {
    BUNDLED_THEME_ICON_SET_IDS,
    BUNDLED_THEME_PACK_IDS,
    normalizeThemeIconSetRegistry,
    normalizeThemePackRegistry,
} from '../state/theme-library-store.js';
import {
    createDefaultSagaStorageFallback,
    createDefaultSagaStorageSettings,
    createSagaStorageIndexStore,
    normalizeSagaStorageFallback,
    normalizeSagaStorageSettings,
    SAGA_STORAGE_DOMAIN_INDEX_FILES,
    SAGA_STORAGE_INDEX_PATH,
    SAGA_STORAGE_MIGRATION_VERSION,
} from './saga-storage-index.js';
import {
    flushSagaLorepackPayloadStorageWrites,
    upsertExternalLorepackPayloadSync,
} from './saga-lorepack-payload-storage.js';
import {
    flushSagaLorepackLibraryStorageWrites,
    hydrateSagaLorepackLibraryStorage,
    importExternalLoredeckLibraryRegistrySync,
} from './saga-lorepack-library-storage.js';
import {
    flushSagaCreatorProjectStorageWrites,
    hydrateSagaCreatorProjectStorage,
    upsertExternalLoredeckCreatorProjectSync,
} from './saga-creator-project-storage.js';
import {
    hydrateSagaThemeIconStorage,
    importExternalIconSet,
    importExternalThemePack,
} from './saga-theme-icon-storage.js';
import { createSagaFileApi } from './saga-file-api.js';

const EMPTY_LOREDECK_LIBRARY = Object.freeze({ schemaVersion: 1, packs: Object.freeze({}) });
const EMPTY_CREATOR_REGISTRY = Object.freeze({ schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: Object.freeze({}) });
const EMPTY_THEME_PACK_LIBRARY = Object.freeze({ schemaVersion: 1, packs: Object.freeze({}) });
const EMPTY_ICON_SET_LIBRARY = Object.freeze({ schemaVersion: 1, iconSets: Object.freeze({}) });

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, Number(fallback) || 0);
    return Math.floor(numeric);
}

function getClockNow(options = {}) {
    if (typeof options.now === 'function') return normalizeTimestamp(options.now(), Date.now());
    if (options.now !== undefined) return normalizeTimestamp(options.now, Date.now());
    return Date.now();
}

function getLorepackId(pack = {}, fallback = '') {
    return String(pack?.packId || pack?.id || fallback || '').trim();
}

function getCreatorJobId(job = {}, fallback = '') {
    return String(job?.jobId || job?.projectId || job?.id || fallback || '').trim();
}

function getThemePackId(pack = {}, fallback = '') {
    return String(pack?.id || pack?.themeId || fallback || '').trim();
}

function getIconSetId(iconSet = {}, fallback = '') {
    return String(iconSet?.id || iconSet?.iconSetId || fallback || '').trim();
}

function getBundledLorepackIds() {
    return new Set(Object.keys(DEFAULT_SETTINGS.loredeckLibrary?.packs || {})
        .filter(packId => DEFAULT_SETTINGS.loredeckLibrary.packs[packId]?.type === 'bundled'));
}

function hasOwnCollectionRecords(value = {}, collectionKey = '') {
    return !!(value && typeof value === 'object'
        && value[collectionKey] && typeof value[collectionKey] === 'object'
        && !Array.isArray(value[collectionKey])
        && Object.keys(value[collectionKey]).length);
}

function hasOwnArrayRecords(value = {}, key = '') {
    return Array.isArray(value?.[key]) && value[key].length > 0;
}

function collectLegacyLoredeckLibrary(settings = {}) {
    const raw = isPlainObject(settings.loredeckLibrary) ? settings.loredeckLibrary : {};
    const normalized = normalizeLoredeckRegistry(raw, EMPTY_LOREDECK_LIBRARY);
    const bundledIds = getBundledLorepackIds();
    const packs = {};
    const skipped = [];
    for (const [packId, pack] of Object.entries(normalized.packs || {})) {
        const id = getLorepackId(pack, packId);
        if (!id) continue;
        if (bundledIds.has(id) || pack.type === 'bundled') {
            skipped.push({ domain: 'library', id, reason: 'bundled_lorepack' });
            continue;
        }
        packs[id] = pack;
    }
    return {
        registry: {
            schemaVersion: 1,
            packs,
            folders: normalized.folders || [],
            deckPlacements: normalized.deckPlacements || [],
            activeStack: normalized.activeStack || [],
        },
        skipped,
        settingsCompactionNeeded: hasOwnCollectionRecords(raw, 'packs')
            || hasOwnArrayRecords(raw, 'folders')
            || hasOwnArrayRecords(raw, 'deckPlacements')
            || hasOwnArrayRecords(raw, 'activeStack'),
    };
}

function collectLegacyCreatorProjects(settings = {}) {
    const raw = isPlainObject(settings.loredeckCreatorProjects) ? settings.loredeckCreatorProjects : {};
    const normalized = normalizeLoredeckCreatorRegistry(raw);
    return {
        registry: normalized,
        settingsCompactionNeeded: hasOwnCollectionRecords(raw, 'jobs')
            || String(raw.activeJobId || raw.lastJobId || '').trim() !== '',
    };
}

function collectLegacyThemePacks(settings = {}) {
    const raw = isPlainObject(settings.themePackLibrary) ? settings.themePackLibrary : {};
    const normalized = normalizeThemePackRegistry(raw, EMPTY_THEME_PACK_LIBRARY);
    const packs = {};
    const skipped = [];
    for (const [themeId, pack] of Object.entries(normalized.packs || {})) {
        const id = getThemePackId(pack, themeId);
        if (!id) continue;
        if (BUNDLED_THEME_PACK_IDS.includes(id) || pack.type === 'bundled') {
            skipped.push({ domain: 'themes', id, reason: 'bundled_theme_pack' });
            continue;
        }
        packs[id] = pack;
    }
    return {
        registry: { schemaVersion: 1, packs },
        skipped,
        settingsCompactionNeeded: hasOwnCollectionRecords(raw, 'packs'),
    };
}

function collectLegacyIconSets(settings = {}) {
    const raw = isPlainObject(settings.themeIconSetLibrary) ? settings.themeIconSetLibrary : {};
    const normalized = normalizeThemeIconSetRegistry(raw, EMPTY_ICON_SET_LIBRARY);
    const iconSets = {};
    const skipped = [];
    for (const [iconSetId, iconSet] of Object.entries(normalized.iconSets || {})) {
        const id = getIconSetId(iconSet, iconSetId);
        if (!id) continue;
        if (BUNDLED_THEME_ICON_SET_IDS.includes(id) || iconSet.type === 'bundled') {
            skipped.push({ domain: 'iconSets', id, reason: 'bundled_icon_set' });
            continue;
        }
        iconSets[id] = iconSet;
    }
    return {
        registry: { schemaVersion: 1, iconSets },
        skipped,
        settingsCompactionNeeded: hasOwnCollectionRecords(raw, 'iconSets'),
    };
}

function getPlanCounts(plan = {}) {
    const libraryPacks = Object.keys(plan.libraryRegistry?.packs || {}).length;
    const creatorProjects = Object.keys(plan.creatorRegistry?.jobs || {}).length;
    const themePacks = Object.keys(plan.themePackRegistry?.packs || {}).length;
    const iconSets = Object.keys(plan.themeIconSetRegistry?.iconSets || {}).length;
    const libraryLayoutRecords = [
        ...(plan.libraryRegistry?.folders || []),
        ...(plan.libraryRegistry?.deckPlacements || []),
        ...(plan.libraryRegistry?.activeStack || []),
    ].length;
    return {
        libraryPacks,
        libraryLayoutRecords,
        creatorProjects,
        themePacks,
        iconSets,
        totalPayloads: libraryPacks + creatorProjects + themePacks + iconSets,
    };
}

export function createSagaStorageMigrationPlan(settings = {}, options = {}) {
    const now = getClockNow(options);
    const storage = normalizeSagaStorageSettings(settings.sagaStorage || {});
    const alreadyMigrated = storage.migrationVersion === SAGA_STORAGE_MIGRATION_VERSION && options.force !== true;
    const library = collectLegacyLoredeckLibrary(settings);
    const creator = collectLegacyCreatorProjects(settings);
    const themes = collectLegacyThemePacks(settings);
    const iconSets = collectLegacyIconSets(settings);
    const plan = {
        schemaVersion: 1,
        kind: 'saga_storage_migration_plan',
        migrationVersion: SAGA_STORAGE_MIGRATION_VERSION,
        createdAt: now,
        alreadyMigrated,
        libraryRegistry: library.registry,
        creatorRegistry: creator.registry,
        themePackRegistry: themes.registry,
        themeIconSetRegistry: iconSets.registry,
        skipped: [
            ...(library.skipped || []),
            ...(themes.skipped || []),
            ...(iconSets.skipped || []),
        ],
        settingsCompactionNeeded: library.settingsCompactionNeeded
            || creator.settingsCompactionNeeded
            || themes.settingsCompactionNeeded
            || iconSets.settingsCompactionNeeded,
    };
    plan.counts = getPlanCounts(plan);
    plan.needsMigration = !alreadyMigrated && (
        plan.settingsCompactionNeeded
        || plan.counts.totalPayloads > 0
        || plan.counts.libraryLayoutRecords > 0
    );
    return plan;
}

export function hasLegacySagaStoragePayloads(settings = {}, options = {}) {
    return createSagaStorageMigrationPlan(settings, options).needsMigration;
}

export function createCompactedSagaSettingsAfterStorageMigration(settings = {}, result = {}, options = {}) {
    const migratedAt = normalizeTimestamp(result.migratedAt || options.migratedAt || getClockNow(options), Date.now());
    const compact = cloneJson(isPlainObject(settings) ? settings : {});
    compact.sagaStorage = normalizeSagaStorageSettings({
        ...(compact.sagaStorage || createDefaultSagaStorageSettings()),
        enabled: true,
        masterIndexFile: SAGA_STORAGE_INDEX_PATH,
        libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
        iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        lastMigrationAt: migratedAt,
        migrationVersion: SAGA_STORAGE_MIGRATION_VERSION,
    });
    compact.sagaStorageFallback = normalizeSagaStorageFallback({
        ...(compact.sagaStorageFallback || createDefaultSagaStorageFallback()),
        libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
        iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        updatedAt: migratedAt,
    });
    compact.loredeckLibrary = {
        schemaVersion: 1,
        packs: {},
        folders: [],
        deckPlacements: [],
        activeStack: [],
    };
    compact.loredeckCreatorProjects = {
        schemaVersion: 1,
        activeJobId: '',
        lastJobId: '',
        jobs: {},
    };
    compact.themePackLibrary = {
        schemaVersion: 1,
        packs: {},
    };
    compact.themeIconSetLibrary = {
        schemaVersion: 1,
        iconSets: {},
    };
    return compact;
}

export function compactSagaStateAfterStorageMigration(state = {}, plan = {}) {
    if (!isPlainObject(state)) return { state, changed: false };
    const next = cloneJson(state);
    let changed = false;
    const migratedPackIds = new Set(Object.keys(plan.libraryRegistry?.packs || {}));
    if (migratedPackIds.size && isPlainObject(next.loredeckRegistry)) {
        const registry = normalizeLoredeckRegistry(next.loredeckRegistry, EMPTY_LOREDECK_LIBRARY);
        const packs = {};
        for (const [packId, pack] of Object.entries(registry.packs || {})) {
            if (!migratedPackIds.has(packId)) packs[packId] = pack;
            else changed = true;
        }
        if (changed) {
            next.loredeckRegistry = normalizeLoredeckRegistry({
                ...registry,
                packs,
            }, EMPTY_LOREDECK_LIBRARY);
        }
    }
    const migratedJobIds = new Set(Object.keys(plan.creatorRegistry?.jobs || {}));
    if (migratedJobIds.size && isPlainObject(next.loredeckCreator)) {
        const registry = normalizeLoredeckCreatorRegistry(next.loredeckCreator);
        const jobs = {};
        let creatorChanged = false;
        for (const [jobId, job] of Object.entries(registry.jobs || {})) {
            if (!migratedJobIds.has(jobId)) jobs[jobId] = job;
            else creatorChanged = true;
        }
        if (creatorChanged) {
            const activeJobId = migratedJobIds.has(registry.activeJobId) ? '' : registry.activeJobId;
            const lastJobId = migratedJobIds.has(registry.lastJobId) ? activeJobId : registry.lastJobId;
            next.loredeckCreator = normalizeLoredeckCreatorRegistry({
                schemaVersion: 1,
                activeJobId,
                lastJobId,
                jobs,
            });
            changed = true;
        }
    }
    return { state: next, changed };
}

function throwIfFailed(result = {}, fallback = 'Saga storage migration failed.') {
    if (result?.ok !== false) return result;
    throw new Error(result.error || fallback);
}

async function hydrateExistingExternalStorage(options = {}) {
    await hydrateSagaLorepackLibraryStorage({ ...options, force: true });
    await hydrateSagaCreatorProjectStorage({ ...options, force: true });
    await hydrateSagaThemeIconStorage({ ...options, force: true });
}

export async function executeSagaStorageMigration(settings = {}, options = {}) {
    const plan = options.plan || createSagaStorageMigrationPlan(settings, options);
    if (!plan.needsMigration) {
        return {
            ok: true,
            skipped: true,
            reason: plan.alreadyMigrated ? 'already_migrated' : 'nothing_to_migrate',
            plan,
        };
    }

    try {
        const migratedAt = getClockNow(options);
        await hydrateExistingExternalStorage(options);
        const libraryRecords = {};
        let payloadFlush = { ok: true, pendingWrites: 0 };
        let libraryFlush = { ok: true, library: null, pendingWrites: 0 };
        let creatorFlush = { ok: true, registry: null, pendingWrites: 0 };
        for (const [packId, pack] of Object.entries(plan.libraryRegistry?.packs || {})) {
            const payloadResult = throwIfFailed(
                upsertExternalLorepackPayloadSync(pack, options),
                `Lorepack ${packId} could not be externalized.`,
            );
            libraryRecords[packId] = payloadResult.libraryRecord;
        }
        if (Object.keys(libraryRecords).length
            || (plan.libraryRegistry?.folders || []).length
            || (plan.libraryRegistry?.deckPlacements || []).length
            || (plan.libraryRegistry?.activeStack || []).length) {
            throwIfFailed(importExternalLoredeckLibraryRegistrySync({
                schemaVersion: 1,
                packs: libraryRecords,
                folders: plan.libraryRegistry?.folders || [],
                deckPlacements: plan.libraryRegistry?.deckPlacements || [],
                activeStack: plan.libraryRegistry?.activeStack || [],
            }, options), 'Lorepack Library index could not be externalized.');
        }
        payloadFlush = await flushSagaLorepackPayloadStorageWrites();
        throwIfFailed(payloadFlush, 'Lorepack payload writes did not complete.');
        libraryFlush = await flushSagaLorepackLibraryStorageWrites();
        throwIfFailed(libraryFlush, 'Lorepack Library index writes did not complete.');

        for (const [jobId, job] of Object.entries(plan.creatorRegistry?.jobs || {})) {
            throwIfFailed(upsertExternalLoredeckCreatorProjectSync(job, {
                ...options,
                activeJobId: plan.creatorRegistry.activeJobId,
                lastJobId: plan.creatorRegistry.lastJobId,
                activate: plan.creatorRegistry.activeJobId === jobId,
            }), `Creator project ${jobId} could not be externalized.`);
        }
        creatorFlush = await flushSagaCreatorProjectStorageWrites();
        throwIfFailed(creatorFlush, 'Creator project writes did not complete.');

        for (const [themeId, pack] of Object.entries(plan.themePackRegistry?.packs || {})) {
            throwIfFailed(await importExternalThemePack(pack, options), `Theme Pack ${themeId} could not be externalized.`);
        }

        for (const [iconSetId, iconSet] of Object.entries(plan.themeIconSetRegistry?.iconSets || {})) {
            throwIfFailed(await importExternalIconSet(iconSet, options), `Icon Set ${iconSetId} could not be externalized.`);
        }

        let integrity = null;
        if (options.verify !== false) {
            const storageIndexStore = options.storageIndexStore || createSagaStorageIndexStore({
                fileApi: options.fileApi || createSagaFileApi(options.fileApiOptions || {}),
                now: options.now,
            });
            integrity = await storageIndexStore.verifyIndexFiles(null, {
                ...options,
                write: options.writeIntegrity !== false,
                bumpRevision: false,
            });
            if (integrity.status !== 'ok') {
                throw new Error(`Saga storage migration verification failed: ${integrity.missingFiles?.length || 0} file(s) missing.`);
            }
        }

        const compactedSettings = createCompactedSagaSettingsAfterStorageMigration(settings, { migratedAt }, options);
        if (typeof options.saveSettings === 'function') {
            await options.saveSettings(compactedSettings);
        }

        let compactedState = null;
        if (isPlainObject(options.state)) {
            compactedState = compactSagaStateAfterStorageMigration(options.state, plan);
            if (compactedState.changed && typeof options.saveState === 'function') {
                await options.saveState(compactedState.state);
            }
        }

        return {
            ok: true,
            migratedAt,
            plan,
            counts: plan.counts,
            integrity,
            compactedSettings,
            compactedState,
            library: libraryFlush.library,
            creator: creatorFlush.registry,
        };
    } catch (error) {
        return {
            ok: false,
            error: String(error?.message || error || 'Saga storage migration failed.'),
            plan,
        };
    }
}
