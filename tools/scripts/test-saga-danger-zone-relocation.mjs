import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const advancedRuntimePanel = await readText('src/runtime/advanced-runtime-panel.js');
const runtimeSettingsTab = await readText('src/settings/runtime-settings-tab.js');
const runtimeSafetyPanel = await readText('src/runtime/runtime-safety-panel.js');
const defaultSettings = await readText('src/state/default-settings.js');
const runtimeGuideContent = await readText('src/runtime/runtime-guide-content.js');
const lorePanel = await readText('src/runtime/lore-panel.js');
const runtimeNavigation = await readText('src/runtime/runtime-navigation.js');
const activeStackPanel = await readText('src/runtime/active-stack-panel.js');
const storageAndStateSafetyDoc = await readText('docs/user/STORAGE_AND_STATE_SAFETY.md');
const operatorManual = await readText('docs/user/OPERATOR_MANUAL.md');
const style = await readText('styles/tokens.css');
const runtimeTheme = await readText('src/theme/runtime-theme.js');

assert(!advancedRuntimePanel.includes('createDangerZoneCard'), 'Session tab must not depend on or render the Danger Zone card.');
assert(runtimeSettingsTab.includes('createDangerZoneCard') && runtimeSettingsTab.includes("'settings.dangerZone'"), 'Settings tab must render the relocated Danger Zone section.');
assert(runtimeSettingsTab.includes('appendDangerZoneCard(container, state)') && !runtimeSettingsTab.includes("'settings.dangerZone',\n            'Danger Zone'") && !runtimeSettingsTab.includes("'settings.dangerZone',\n        'Danger Zone'"), 'Settings Danger Zone must render directly instead of through a collapsible dropdown.');
assert(lorePanel.includes('configureRuntimeSettingsTab({') && lorePanel.includes('createDangerZoneCard,'), 'Runtime settings tab must receive the Danger Zone renderer dependency.');
assert(!lorePanel.includes('configureAdvancedRuntimePanel({\n    createCollapsibleSection,\n    createDangerZoneCard,'), 'Advanced Session panel must not receive the Danger Zone renderer dependency.');
assert(!defaultSettings.includes("'settings.dangerZone'"), 'Danger Zone must not keep a collapsed-section default after the dropdown is removed.');
assert(runtimeTheme.includes("target.style.setProperty('--saga-danger', colors.danger)") && runtimeTheme.includes("target.style.setProperty('--saga-danger-surface', hexToRgba(colors.danger, 0.24))"), 'Runtime themes must publish explicit danger tokens from the active Theme Pack danger color.');
assert(style.includes('.saga-danger-zone-card') && style.includes('var(--saga-danger-surface') && style.includes('var(--saga-danger-soft'), 'Danger Zone card must use active Theme Pack danger surface tokens.');
assert(!/\.saga-danger-zone-title\s*\{[\s\S]*?--saga-danger/.test(style), 'Danger Zone title must inherit the normal runtime card title color instead of becoming danger-on-danger.');
assert(style.includes('.saga-danger-button') && style.includes('var(--saga-danger-hover') && style.includes('var(--saga-danger,'), 'Danger buttons must use active Theme Pack danger tokens.');

assert(runtimeSafetyPanel.includes('Active Chat') && runtimeSafetyPanel.includes('Global'), 'Danger Zone must separate Active Chat and Global groups.');
assert(runtimeSafetyPanel.includes('Reset Active Chat'), 'Active Chat group must expose Reset Active Chat.');
assert(runtimeSafetyPanel.includes("createKeyValue('Accepted Lorecards', String(normalizeLoreMatrix(state?.loreMatrix || []).length)"), 'Active Chat Accepted Lorecards summary must use the normalized lore matrix count.');
assert(runtimeSafetyPanel.includes("createKeyValue('Pending Review', String(normalizeLoreMatrix(state?.pendingLoreEntries || []).length)"), 'Active Chat Pending Review summary must use the normalized pending lore count.');
assert(runtimeSafetyPanel.includes("setText('Clearing lore...'") && runtimeSafetyPanel.includes("setText('Clearing generation state...'") && runtimeSafetyPanel.includes("setText('Resetting active chat...'"), 'Active Chat Danger Zone actions must use visible busy-button states while mutating state.');
assert(runtimeSafetyPanel.includes('current.lorePanel.acceptedSelectedIds = [];'), 'Delete All Lore must clear stale accepted-lore bulk selections.');
assert(runtimeSafetyPanel.includes('current.lorePanel.selectedEntryId = \'\';') && runtimeSafetyPanel.includes('current.lorePanel.reviewSelectedIds = [];'), 'Generation-state reset must clear pending-review selections and stale expanded-entry state.');
assert(runtimeSafetyPanel.includes('function preserveRuntimePanelGeometry') && runtimeSafetyPanel.includes('launcherDismissed') && runtimeSafetyPanel.includes('drawerWidth') && runtimeSafetyPanel.includes("preserveRuntimePanelGeometry(defaults, current?.lorePanel || {}, 'settings')"), 'Reset Active Chat must preserve current rail/drawer panel geometry instead of only legacy x/y/width/height fields.');
assert(!runtimeSafetyPanel.includes("createButton('Total Reset'"), 'Old Total Reset action label must not remain.');
assert(runtimeSafetyPanel.includes('Reset All Settings'), 'Global group must expose Reset All Settings.');
assert(runtimeSafetyPanel.includes('Remove Custom Themes + Icon Packs'), 'Global group must expose custom Theme/Icon cleanup action.');
assert(runtimeSafetyPanel.includes('Remove Custom Loredecks'), 'Global group must expose custom Loredeck cleanup action.');
assert(runtimeSafetyPanel.includes('Total Saga Cleanup'), 'Global group must expose Total Saga Cleanup action.');
assert(runtimeSafetyPanel.includes('function appendGlobalDangerZoneRows') && runtimeSafetyPanel.includes('async function refreshGlobalDangerZoneRows') && runtimeSafetyPanel.includes('void refreshGlobalDangerZoneRows(rows);'), 'Global Danger Zone counts must refresh asynchronously from storage preview instead of relying only on stale cached counts.');
assert(runtimeSafetyPanel.includes('appendGlobalDangerZonePreviewDiagnostics') && runtimeSafetyPanel.includes("'Cleanup counts'") && runtimeSafetyPanel.includes("'Refresh failed'"), 'Global Danger Zone count refresh warnings and failures must be visible in the row list.');
assert(runtimeSafetyPanel.includes('appendGlobalDangerZoneFileScopeRows') && runtimeSafetyPanel.includes("'Cleanup file scope'") && runtimeSafetyPanel.includes('cleanupSnapshot.totalSagaFileCount') && runtimeSafetyPanel.includes('cleanupSnapshot.knownIndexFileCount'), 'Global Danger Zone file-scope rows must use structured cleanup preview counts after async refresh.');
assert(runtimeSafetyPanel.includes('removeSagaCustomThemeIconStorage'), 'Theme/Icon cleanup action must call the global cleanup service.');
assert(runtimeSafetyPanel.includes('removeSagaCustomLoredeckStorage'), 'Loredeck cleanup action must call the global cleanup service.');
assert(activeStackPanel.includes('export function pruneUnavailableLoredeckStackItems') && runtimeSafetyPanel.includes('pruneUnavailableLoredeckStackItems()'), 'Loredeck cleanup must prune deleted custom Loredecks from the active chat stack.');
assert(runtimeSafetyPanel.includes('unavailable active-stack reference'), 'Loredeck cleanup result copy must disclose active-stack pruning when it happens.');
assert(!runtimeSafetyPanel.includes('Legacy payloads') && !runtimeSafetyPanel.includes('toastLegacyScopedCleanupBlocked'), 'Global Danger Zone must not include removed storage payload migration warnings.');
assert(!runtimeSafetyPanel.includes('hasLegacyLoredeckPayloads') && !runtimeSafetyPanel.includes('hasLegacyThemeIconPayloads'), 'Scoped cleanup actions must not detect or preserve removed settings payloads.');
assert(!runtimeSafetyPanel.includes(['Migrate', 'Legacy', 'Storage'].join(' ')) && !runtimeSafetyPanel.includes('formatLegacyScopedCleanupConfirmation'), 'Scoped cleanup must not route users to removed storage migration.');
assert(runtimeSafetyPanel.includes('runSagaTotalStorageCleanup'), 'Total Saga Cleanup action must call the global cleanup service.');
assert(!runtimeSafetyPanel.includes(['legacy', 'settings-backed', 'payloads:'].join(' ')) && runtimeSafetyPanel.includes('formatTotalCleanupPreview(preview)'), 'Total Saga Cleanup preview must not include removed settings payload counts.');
assert(runtimeSafetyPanel.includes('tracked/known/referenced Saga file') && runtimeSafetyPanel.includes('additional referenced file') && runtimeSafetyPanel.includes('repair session'), 'Total Saga Cleanup preview must describe tracked, known, referenced, and repair-session file scope.');
assert(runtimeSafetyPanel.includes('const partial = failed > 0 || errorCount > 0 || result.ok === false;') && runtimeSafetyPanel.includes('const settings = partial ? resetAllSettingsToDefaults() : resetAllSettingsToFreshDefaults();'), 'Total Saga Cleanup must preserve storage bootstrap settings when cleanup partially fails.');
assert(runtimeSafetyPanel.includes('Storage index retained for retry'), 'Total Saga Cleanup partial failure copy must explain that the index remains retryable.');
assert(runtimeSafetyPanel.includes('Switch to Advanced and check State Safety before retry'), 'Total Saga Cleanup partial failure copy must route Basic users to Advanced State Safety.');
assert(runtimeSafetyPanel.includes('appendStateSafetyLog') && runtimeSafetyPanel.includes("type: 'total_cleanup_warning'") && runtimeSafetyPanel.includes('attachTotalCleanupPartialStateSafety(nextState, result)'), 'Total Saga Cleanup partial failures must leave a compact State Safety warning in the reset state.');
assert(storageAndStateSafetyDoc.includes('partially fails') && storageAndStateSafetyDoc.includes('one compact State Safety warning') && storageAndStateSafetyDoc.includes('switch to Advanced and open State Safety'), 'Storage and State Safety docs must explain partial Total Cleanup warning logs and the Basic-to-Advanced handoff.');
assert(operatorManual.includes('If cleanup partially fails') && operatorManual.includes('one compact State Safety warning') && operatorManual.includes('switch to Advanced and open State Safety'), 'Operator Manual must explain partial Total Cleanup warning logs and the Basic-to-Advanced handoff.');
assert(storageAndStateSafetyDoc.includes('Cleanup file scope') && storageAndStateSafetyDoc.includes('tracked files, known index files, additional referenced files, and Health repair sessions') && storageAndStateSafetyDoc.includes('Unknown unindexed orphan files'), 'Storage and State Safety docs must explain the Global Danger Zone cleanup file-scope row and orphan-file boundary.');
assert(operatorManual.includes('Cleanup file scope') && operatorManual.includes('tracked files, known index files, additional referenced files, and Health repair sessions') && operatorManual.includes('not an orphan-file scan'), 'Operator Manual must explain the Global Danger Zone cleanup file-scope row and its scan boundary.');
assert(runtimeSafetyPanel.includes('promptTextAction'), 'Total Saga Cleanup must use typed confirmation.');
assert(runtimeSafetyPanel.includes('DELETE SAGA'), 'Total Saga Cleanup must require explicit typed confirmation text.');
assert(runtimeSafetyPanel.includes('tracked Saga-owned custom content') && runtimeSafetyPanel.includes('Unknown unindexed orphan files that Saga cannot see through its indexes may remain'), 'Total Saga Cleanup confirmation must disclose that cleanup is limited to tracked/known/referenced files.');
assert(!runtimeSafetyPanel.includes('Custom Theme/Icon cleanup is planned next.'), 'Theme/Icon cleanup action must not remain a disabled placeholder.');
assert(!runtimeSafetyPanel.includes('Custom Loredeck cleanup is planned next.'), 'Loredeck cleanup action must not remain a disabled placeholder.');
assert(!runtimeSafetyPanel.includes('Total Saga Cleanup is planned next.'), 'Total Saga Cleanup action must not remain a disabled placeholder.');
assert(runtimeSafetyPanel.includes('Stored Saga API keys were removed') || runtimeSafetyPanel.includes('stored Saga API keys'), 'Reset All Settings copy must disclose key removal.');
assert(runtimeSafetyPanel.includes('clearStoredSecret'), 'Reset All Settings must clear stored provider key material.');
assert(runtimeSafetyPanel.includes('resetAllSettingsFromButton') && runtimeSafetyPanel.includes("runBusyAction(button, 'Resetting...'"), 'Reset All Settings must use the shared busy-button action path.');
assert(runtimeSafetyPanel.includes("runBusyAction(button, 'Checking...'") && runtimeSafetyPanel.includes("setText('Checking storage...')") && runtimeSafetyPanel.includes("setText('Awaiting confirmation...')"), 'Storage-backed global cleanup actions must show busy preflight and confirmation states.');
assert(runtimeSafetyPanel.includes('first:') && runtimeSafetyPanel.includes('Switch to Advanced and check State Safety before retry'), 'Scoped cleanup failure toasts must include compact first-error detail and Advanced State Safety retry guidance.');

assert(runtimeGuideContent.includes("advancedStep('advanced-settings-danger-zone'"), 'Walkthrough cleanup step must use a Settings-owned route id.');
assert(runtimeGuideContent.includes("'settings.dangerZone'"), 'Walkthrough cleanup step must target the relocated Settings Danger Zone.');
assert(!runtimeGuideContent.includes("expandSections: Object.freeze(['settings.dangerZone'])"), 'Walkthrough cleanup step must not try to expand a removed Danger Zone dropdown.');
const legacySessionCleanupStepId = ['advanced-session', 'cleanup-actions'].join('-');
assert(!runtimeGuideContent.includes(legacySessionCleanupStepId), 'Walkthrough cleanup step must not remain grouped as a Session route.');
assert(!runtimeGuideContent.includes(`advancedStep('${legacySessionCleanupStepId}', 'Cleanup Actions', 'Find cleanup or reset actions and understand their risk before using them.', 'session', 'session.metrics'`), 'Walkthrough cleanup step must not point to Session metrics.');
assert(!runtimeNavigation.includes("session: 'Runtime overview, preset status, instructions, and destructive cleanup actions.'"), 'Session tab tooltip must not advertise relocated cleanup actions.');
assert(runtimeNavigation.includes('State Safety, and Danger Zone cleanup'), 'Settings tab tooltip must advertise State Safety and Danger Zone cleanup.');

console.log('Saga Danger Zone relocation tests passed.');
