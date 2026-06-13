import { normalizeLoreMatrix } from '../lorecards/lore-matrix.js';
import { captureLoreTimelineState, recordLoreTimelineEvent } from '../lorecards/lore-timeline.js';
import { clearCanonLoreDatabaseCache } from '../context/canon-lore-db.js';
import { clearContextIndexCache } from '../context/context-index.js';
import { DEFAULT_SETTINGS, getDefaultState } from '../state/constants.js';
import {
    cleanMissingSagaStorageIndexRecords,
    createStateBackup,
    exportSagaState,
    getSettings,
    getSagaStorageDiagnostics,
    getSagaStorageMigrationPlan,
    getState,
    getStateSafety,
    restoreStateFromBackup,
    restoreStateFromExport,
    runSagaStorageMigration,
    saveSettings,
    saveState,
    settleSagaStorageWrites,
    verifySagaStorageIntegrity,
} from '../state/state-manager.js';
import {
    addTooltip,
    confirmAction,
    createButton,
    createKeyValue,
    createStatusPill,
    runBusyAction,
    toast,
} from '../ui/runtime-ui-kit.js';
import { downloadJson } from './runtime-downloads.js';
import { sanitizeFileStem } from './runtime-formatters.js';

const STORED_API_KEY_SETTING_PREFIXES = Object.freeze(['loreOpenAI', 'continuityOpenAI']);
const STORED_API_KEY_SETTING_SUFFIXES = Object.freeze(['Encrypted', 'Salt', 'Iv', 'KeyEncrypted', 'KeySalt', 'KeyIv', 'KeySet']);

let runtimeSafetyPanelDeps = {};

export function configureRuntimeSafetyPanel(deps = {}) {
    runtimeSafetyPanelDeps = { ...runtimeSafetyPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = runtimeSafetyPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Runtime Safety panel dependency is not configured: ${name}`);
}

function refreshPanelBody(options = {}) { return dep('refreshPanelBody', () => null)(options); }
function refreshHeader() { return dep('refreshHeader', () => null)(); }
function refreshRuntimeThemeSurfaces(settings = getSettings()) { return dep('refreshRuntimeThemeSurfaces', () => null)(settings); }
function resetCanonPreviewUiState(options = {}) { return dep('resetCanonPreviewUiState', () => null)(options); }
function cloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function cloneDefaultSettings() {
    return cloneJson(DEFAULT_SETTINGS);
}

function copyStoredApiKeySettings(source, target) {
    if (!source || !target) return target;
    for (const prefix of STORED_API_KEY_SETTING_PREFIXES) {
        for (const suffix of STORED_API_KEY_SETTING_SUFFIXES) {
            const key = `${prefix}${suffix}`;
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = cloneJson(source[key]);
            }
        }
    }
    return target;
}

function resetAllSettingsToDefaults() {
    const current = getSettings();
    const defaults = cloneDefaultSettings();
    copyStoredApiKeySettings(current, defaults);
    saveSettings(defaults);
    return defaults;
}

export function resetSettingKeysToDefaults(settingKeys, label = 'Settings') {
    const keys = Array.isArray(settingKeys) ? settingKeys : [];
    if (!keys.length) return;

    const next = getSettings();
    let changed = 0;
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) continue;
        next[key] = cloneJson(DEFAULT_SETTINGS[key]);
        changed += 1;
    }

    if (!changed) return;
    saveSettings(next);
    refreshRuntimeThemeSurfaces(next);
    refreshPanelBody({ preserveScroll: true });
    refreshHeader();
    toast(`${label} reset to defaults.`, 'info');
}

export function appendSettingsResetButton(container, settingKeys, label = 'Settings') {
    if (!container || !Array.isArray(settingKeys) || !settingKeys.length) return;
    const row = document.createElement('div');
    row.className = 'saga-settings-reset-row';
    row.appendChild(createButton(
        'Reset Defaults',
        `Reset only the ${label.toLowerCase()} controls in this section to bundled defaults.`,
        () => resetSettingKeysToDefaults(settingKeys, label),
        'saga-small-button saga-settings-reset-button'
    ));
    container.appendChild(row);
}

function formatStateSafetyTimestamp(value) {
    const time = Number(value) || 0;
    return time ? new Date(time).toLocaleString() : 'never';
}

function downloadSagaStateExport() {
    const state = getState();
    const exported = JSON.parse(exportSagaState(state));
    const stem = sanitizeFileStem(`saga-state-${new Date().toISOString().slice(0, 10)}`);
    downloadJson(exported, `${stem}.json`);
    toast('Saga state exported.', 'success');
}

function restoreSagaStateFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const proceed = await confirmAction(
            'Restore Saga state from file?',
            'Saga will back up the current chat state before replacing it with the selected exported state JSON. Continue?'
        );
        if (!proceed) return;
        try {
            const result = restoreStateFromExport(await file.text());
            if (!result.ok) throw new Error(result.error || 'State restore failed.');
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
            toast('Saga state restored from file.', 'success');
        } catch (e) {
            toast(e?.message || 'Saga state restore failed.', 'error');
        }
    }, { once: true });
    input.click();
}

function formatStorageMigrationCounts(plan = {}) {
    const counts = plan.counts || {};
    const parts = [
        counts.libraryPacks ? `${counts.libraryPacks} Loredeck${counts.libraryPacks === 1 ? '' : 's'}` : '',
        counts.creatorProjects ? `${counts.creatorProjects} Creator project${counts.creatorProjects === 1 ? '' : 's'}` : '',
        counts.themePacks ? `${counts.themePacks} Theme Pack${counts.themePacks === 1 ? '' : 's'}` : '',
        counts.iconSets ? `${counts.iconSets} Icon Set${counts.iconSets === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    return plan.alreadyMigrated ? 'external-files-v1' : 'none';
}

function getStorageMigrationLabel(plan = {}) {
    if (plan.needsMigration) return 'Storage migration needed';
    if (plan.alreadyMigrated) return 'Storage externalized';
    return 'Storage current';
}

function getStorageDiagnosticsLabel(diagnostics = {}) {
    if (diagnostics.status === 'ok') return 'Storage verified';
    if (diagnostics.status === 'missing_files') return `${diagnostics.missingFileCount || 0} missing file${diagnostics.missingFileCount === 1 ? '' : 's'}`;
    if (diagnostics.status === 'missing_index') return 'Storage index missing';
    if (diagnostics.status === 'write_errors') return 'Storage write errors';
    return diagnostics.checkedAt ? 'Storage check stale' : 'Storage not checked';
}

function getStorageDiagnosticsTone(diagnostics = {}) {
    if (diagnostics.status === 'ok') return 'success';
    if (['missing_files', 'missing_index', 'write_errors', 'errors'].includes(diagnostics.status)) return 'warning';
    return 'muted';
}

function formatStorageDiagnosticsSummary(diagnostics = {}) {
    if (diagnostics.status === 'ok') return `${diagnostics.fileCount || 0} tracked`;
    if (diagnostics.status === 'missing_files') return `${diagnostics.fileCount || 0} tracked, ${diagnostics.missingFileCount || 0} missing`;
    if (diagnostics.status === 'write_errors') return `${diagnostics.writeErrors?.length || 0} write error${diagnostics.writeErrors?.length === 1 ? '' : 's'}`;
    if (diagnostics.status === 'missing_index') return 'index missing';
    if (diagnostics.pendingWrites) return `${diagnostics.pendingWrites} pending write${diagnostics.pendingWrites === 1 ? '' : 's'}`;
    return diagnostics.checkedAt ? `last checked ${formatStateSafetyTimestamp(diagnostics.checkedAt)}` : 'not checked';
}

async function runStorageMigrationFromButton(button) {
    const plan = getSagaStorageMigrationPlan();
    if (!plan.needsMigration) {
        toast(plan.alreadyMigrated ? 'Saga storage is already externalized.' : 'No legacy Saga storage payloads were found.', 'info');
        return;
    }
    const proceed = await confirmAction(
        'Migrate Saga storage?',
        `Externalize ${formatStorageMigrationCounts(plan)} into Saga-owned /user/files JSON. Settings will keep compact pointers. Continue?`
    );
    if (!proceed) return;
    await runBusyAction(button, 'Migrating...', async ({ setText }) => {
        setText('Writing files...');
        const result = await runSagaStorageMigration();
        if (!result.ok) throw new Error(result.error || 'Saga storage migration failed.');
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast(`Saga storage migrated: ${formatStorageMigrationCounts(result.plan)}.`, 'success');
    });
}

async function verifyStorageFromButton(button) {
    await runBusyAction(button, 'Verifying...', async () => {
        const result = await verifySagaStorageIntegrity({ write: true });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        const summary = formatStorageDiagnosticsSummary(result);
        toast(result.ok ? `Saga storage verified: ${summary}.` : `Saga storage needs attention: ${summary}.`, result.ok ? 'success' : 'warning');
    });
}

async function settleStorageWritesFromButton(button) {
    await runBusyAction(button, 'Settling...', async () => {
        const result = await settleSagaStorageWrites({ write: true });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        const summary = formatStorageDiagnosticsSummary(result);
        toast(result.ok ? `Saga storage writes settled: ${summary}.` : `Saga storage writes need attention: ${summary}.`, result.ok ? 'success' : 'warning');
    });
}

async function cleanMissingStorageRecordsFromButton(button) {
    const proceed = await confirmAction(
        'Clean missing Saga storage records?',
        'Saga will verify the master storage index and remove records for missing non-index files. It will not scan for unknown orphan files or delete Library rows. Continue?'
    );
    if (!proceed) return;
    await runBusyAction(button, 'Cleaning...', async () => {
        const result = await cleanMissingSagaStorageIndexRecords({ write: true });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        const cleaned = result.cleanedFileCount || 0;
        const protectedCount = result.protectedMissingFileCount || 0;
        if (cleaned) {
            toast(`Cleaned ${cleaned} missing storage record${cleaned === 1 ? '' : 's'}${protectedCount ? `; ${protectedCount} protected missing index record${protectedCount === 1 ? '' : 's'} still need review` : ''}.`, protectedCount ? 'warning' : 'success');
            return;
        }
        toast(protectedCount
            ? `${protectedCount} missing protected storage record${protectedCount === 1 ? '' : 's'} still need review.`
            : 'No missing non-index storage records were found.',
        protectedCount ? 'warning' : 'info');
    });
}

export function createStateSafetyCard(state = getState()) {
    const safety = getStateSafety(state);
    const storageMigrationPlan = getSagaStorageMigrationPlan();
    const storageDiagnostics = getSagaStorageDiagnostics();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-state-safety-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'State Safety';
    addTooltip(title, 'Backup, export, restore, and schema-normalization records for the current chat Saga state.');
    card.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${safety.backups.length} backup${safety.backups.length === 1 ? '' : 's'}`, 'Automatic and manual Saga state backups stored in this chat.', { tone: safety.backups.length ? 'source' : 'muted', kind: 'count' }));
    summary.appendChild(createStatusPill(`${safety.migrationLog.length} log${safety.migrationLog.length === 1 ? '' : 's'}`, 'Schema migration and restore log entries.', { tone: safety.migrationLog.length ? 'info' : 'muted', kind: 'count' }));
    summary.appendChild(createStatusPill(getStorageMigrationLabel(storageMigrationPlan), `Legacy payloads: ${formatStorageMigrationCounts(storageMigrationPlan)}`, { tone: storageMigrationPlan.needsMigration ? 'warning' : 'success', kind: 'status', maxChars: 34 }));
    summary.appendChild(createStatusPill(getStorageDiagnosticsLabel(storageDiagnostics), formatStorageDiagnosticsSummary(storageDiagnostics), { tone: getStorageDiagnosticsTone(storageDiagnostics), kind: 'status', maxChars: 34 }));
    if (safety.lastBackupAt) summary.appendChild(createStatusPill(`Last backup ${formatStateSafetyTimestamp(safety.lastBackupAt)}`, `Reason: ${safety.lastBackupReason || 'unknown'}`, { tone: 'source', kind: 'source', maxChars: 36 }));
    if (safety.lastRestoreAt) summary.appendChild(createStatusPill(`Last restore ${formatStateSafetyTimestamp(safety.lastRestoreAt)}`, `Source: ${safety.lastRestoreSource || 'unknown'}`, { tone: 'source', kind: 'source', maxChars: 36 }));
    card.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Backup Now', 'Create a Saga state backup in this chat before testing risky alpha workflows.', () => {
        createStateBackup('manual');
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast('Saga state backup created.', 'success');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Export State', 'Download the current Saga chat state as restoreable JSON.', () => {
        downloadSagaStateExport();
    }));
    actions.appendChild(createButton('Restore From File', 'Restore Saga chat state from an exported Saga state JSON file.', () => {
        restoreSagaStateFromFile();
    }));
    const migrateStorage = createButton(
        storageMigrationPlan.needsMigration ? 'Migrate Legacy Storage' : 'Storage Current',
        storageMigrationPlan.needsMigration
            ? 'Move legacy settings-backed Saga content into flat /user/files JSON storage.'
            : 'No legacy settings-backed Saga content needs migration.',
        button => runStorageMigrationFromButton(button)
    );
    migrateStorage.disabled = !storageMigrationPlan.needsMigration;
    actions.appendChild(migrateStorage);
    actions.appendChild(createButton('Verify Storage', 'Verify Saga-owned /user/files records listed in the storage index.', button => {
        verifyStorageFromButton(button);
    }));
    const settleWrites = createButton('Settle Storage Writes', 'Wait for queued Saga storage writes to finish, then verify the storage index.', button => {
        settleStorageWritesFromButton(button);
    });
    settleWrites.disabled = !(storageDiagnostics.pendingWrites || (storageDiagnostics.writeErrors || []).length);
    actions.appendChild(settleWrites);
    actions.appendChild(createButton('Clean Missing Records', 'Verify the storage index and remove missing non-index file records. This does not scan for unknown orphan files.', button => {
        cleanMissingStorageRecordsFromButton(button);
    }));
    const latest = safety.backups[0] || null;
    const restoreLatest = createButton('Restore Latest Backup', 'Restore the newest in-chat Saga state backup. A new backup is created before restoring.', async () => {
        if (!latest) return;
        const proceed = await confirmAction(
            'Restore latest Saga backup?',
            `Restore backup ${latest.label || latest.reason || latest.id} from ${formatStateSafetyTimestamp(latest.createdAt)}? Saga will back up the current state first.`
        );
        if (!proceed) return;
        const result = restoreStateFromBackup(latest.id);
        if (!result.ok) {
            toast(result.error || 'Saga state restore failed.', 'error');
            return;
        }
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Latest Saga state backup restored.', 'success');
    }, 'saga-danger-button');
    restoreLatest.disabled = !latest;
    actions.appendChild(restoreLatest);
    card.appendChild(actions);

    const latestRows = document.createElement('div');
    latestRows.className = 'saga-runtime-kv-list';
    latestRows.appendChild(createKeyValue('Latest backup', latest ? `${latest.reason} | ${formatStateSafetyTimestamp(latest.createdAt)}` : 'none', 'Most recent automatic or manual backup.'));
    latestRows.appendChild(createKeyValue('Latest migration log', safety.migrationLog[0]?.message || 'none', 'Most recent schema migration or restore event.'));
    latestRows.appendChild(createKeyValue('Storage migration', formatStorageMigrationCounts(storageMigrationPlan), 'Legacy settings-backed payloads that can be moved to external Saga storage.'));
    latestRows.appendChild(createKeyValue('Storage integrity', formatStorageDiagnosticsSummary(storageDiagnostics), 'Latest Saga storage verification summary from the master index.'));
    card.appendChild(latestRows);

    return card;
}

export function createDangerZoneCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-danger-zone-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-danger-zone-title';
    title.textContent = 'Danger Zone';
    addTooltip(title, 'Destructive cleanup actions for the current chat. Deleted accepted lore can be recovered through Lore Timeline when payloads are retained. Total Reset clears all Saga data.');
    card.appendChild(title);

    card.appendChild(createKeyValue('Accepted lore', String((state?.loreMatrix || []).length), 'Lore entries currently stored in the accepted lore matrix.'));
    card.appendChild(createKeyValue('Pending Lorecards', String((state?.pendingLoreEntries || []).length), 'Generated Lorecards waiting in the Lorecards tab Pending Lorecard Review section.'));
    card.appendChild(createKeyValue('Pending continuity changes', state?.lastDelta ? '1' : '0', 'Legacy extracted continuity delta waiting in the Continuity tab.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';

    actions.appendChild(createButton('Delete All Lore', 'Deletes accepted lore, pending lore, and pin/mute selections. Lightweight continuity state is left intact.', async () => {
        const proceed = await confirmAction('Are you sure? Delete all Saga lore?', 'You are about to delete every accepted lore entry, every pending lore entry, and all pin/mute selections for this chat. Lightweight continuity state will remain. Accepted lore can be restored to Pending Review through Lore Timeline when retained. Continue?');
        if (!proceed) return;
        createStateBackup('before_delete_all_lore');
        const current = getState();
        const beforeTimeline = captureLoreTimelineState(current);
        const deleted = normalizeLoreMatrix(current.loreMatrix || []).length;
        current.loreMatrix = [];
        current.pendingLoreEntries = [];
        current.pendingLoreMeta = null;
        current.loreSelection = { pinnedIds: [], suppressedIds: [] };
        if (current.lorePanel) {
            current.lorePanel.selectedEntryId = '';
            current.lorePanel.reviewSelectedIds = [];
        }
        if (deleted > 0) {
            recordLoreTimelineEvent(current, {
                before: beforeTimeline,
                after: captureLoreTimelineState(current),
                type: 'delete_all',
                source: 'danger_zone',
                summary: `Deleted all accepted lore (${deleted} entr${deleted === 1 ? 'y' : 'ies'}).`,
            });
        }
        saveState(current);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('All lore entries deleted.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Reset Generation State', 'Clears detected lore context, pending generated lore, pending deltas, and generation ledger. Accepted lore remains intact.', async () => {
        const proceed = await confirmAction('Are you sure? Reset generation state?', 'You are about to clear detected context, pending generated lore, pending continuity changes, and the lore-generation ledger. Accepted lore entries and Lore Timeline will remain. Continue?');
        if (!proceed) return;
        createStateBackup('before_generation_reset');
        const current = getState();
        const defaults = getDefaultState();
        current.loreContext = defaults.loreContext;
        current.pendingLoreEntries = [];
        current.pendingLoreMeta = null;
        current.loreGeneration = defaults.loreGeneration;
        current.loreBulkGeneration = defaults.loreBulkGeneration;
        current.continuityScan = defaults.continuityScan;
        current.lastDelta = null;
        if (current.lorePanel) current.lorePanel.reviewSelectedIds = [];
        resetCanonPreviewUiState();
        clearCanonLoreDatabaseCache();
        saveState(current);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Generation state reset.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Reset All Settings', 'Resets Saga preferences and provider settings to bundled defaults. Stored API keys are preserved.', async () => {
        const proceed = await confirmAction('Are you sure? Reset all Saga settings?', 'You are about to reset Saga preferences, workflow settings, provider selections, generation settings, injection settings, and UI defaults. Stored API keys are preserved. Chat state, accepted lore, pending lore, and Lore Timeline are not changed. Continue?');
        if (!proceed) return;
        const settings = resetAllSettingsToDefaults();
        refreshRuntimeThemeSurfaces(settings);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Saga settings reset to defaults. Stored API keys were preserved.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Total Reset', 'Resets Saga continuity state for this chat to defaults and clears Lore Timeline. Panel size and position are preserved.', async () => {
        const proceed = await confirmAction('Are you sure? Total reset?', 'You are about to reset all Saga runtime data for this chat: lightweight continuity state, accepted lore, pending lore, generation state, and Lore Timeline. Window position, size, and the State Safety backup list are preserved. Continue?');
        if (!proceed) return;
        createStateBackup('before_total_reset');
        const current = getState();
        const defaults = getDefaultState();
        defaults.stateSafety = getStateSafety(current);
        if (current.lorePanel) {
            defaults.lorePanel = {
                ...defaults.lorePanel,
                isOpen: true,
                x: current.lorePanel.x,
                y: current.lorePanel.y,
                width: current.lorePanel.width,
                height: current.lorePanel.height,
                activeTab: 'session',
            };
        }
        resetCanonPreviewUiState({ preserveDetailLevel: false });
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        saveState(defaults);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Saga state reset. Lore Timeline cleared.', 'info');
    }, 'saga-danger-button'));

    card.appendChild(actions);
    return card;
}
