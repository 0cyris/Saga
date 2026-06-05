import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const harnessPath = path.join(root, 'tests', 'visual-smoke.html');
const fixturePath = path.join(root, 'tests', 'fixtures', 'arlong-park-update.saga-loredeck.json');
const loredeckIndexPath = path.join(root, 'Loredecks', 'index.json');
const panelPath = path.join(root, 'lore-panel.js');
const assistantPath = path.join(root, 'loredeck-assistant.js');
const stylePath = path.join(root, 'style.css');
const settingsTemplatePath = path.join(root, 'settings.html');
const sagaHeroIconPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'saga-tab-loredecks-256.png');
const sagaHeroManifestPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'icons.json');
const sagaGoldIconPath = path.join(root, 'Images', 'iconsets', 'saga-gold', '256', 'loredecks.png');
const sagaGoldManifestPath = path.join(root, 'Images', 'iconsets', 'saga-gold', 'icons.json');
const hpCoreCoverPath = path.join(root, 'Loredecks', 'hp-core', 'assets', 'cover.png');
const hpYearOneCoverPath = path.join(root, 'Loredecks', 'hp-year-1-philosophers-stone', 'assets', 'cover.png');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const harness = read(harnessPath);
const fixture = JSON.parse(read(fixturePath));
const loredeckIndex = JSON.parse(read(loredeckIndexPath));
const panel = read(panelPath);
const assistant = read(assistantPath);
const style = read(stylePath);
const settingsTemplate = read(settingsTemplatePath);

assert(harness.includes("import { showLorePanel } from '../lore-panel.js';"), 'Harness must import the real runtime panel.');
assert(fs.existsSync(sagaHeroIconPath), 'Bundled Saga Hero Loredecks icon must exist.');
assert(JSON.parse(read(sagaHeroManifestPath)).id === 'saga-hero', 'Bundled Saga Hero Icon Set manifest must exist.');
assert(fs.existsSync(sagaGoldIconPath), 'Bundled Saga Gold Loredecks icon must exist.');
assert(JSON.parse(read(sagaGoldManifestPath)).id === 'saga-gold', 'Bundled Saga Gold Icon Set manifest must exist.');
assert(fs.existsSync(hpCoreCoverPath), 'Bundled HP Core Loredeck cover must be deck-local.');
assert(fs.existsSync(hpYearOneCoverPath), 'Bundled HP Year 1 Loredeck cover must be deck-local.');
assert((loredeckIndex.bundled || []).some(record => record.packId === 'hp-core' && record.assets?.cover?.path === 'assets/cover.png'), 'Bundled HP index records must expose deck-local cover paths.');
assert(harness.includes('window.SillyTavern'), 'Harness must stub SillyTavern before importing modules.');
assert(harness.includes('window.__sagaSmokeReady = true'), 'Harness must expose a smoke-ready marker.');
assert(harness.includes("activeTab: 'loredecks'"), 'Harness must open directly to the Loredecks tab.');
assert(harness.includes("selectedLoredeckId: customPack.packId"), 'Harness must select the seeded Custom Loredeck.');
assert(harness.includes('pendingChanges'), 'Harness must seed Pending Review content.');
assert(harness.includes('source: {'), 'Harness must seed source/update metadata.');
assert(harness.includes('./fixtures/arlong-park-update.saga-loredeck.json'), 'Harness must point at the local update fixture.');
assert(!settingsTemplate.includes('Provider Settings'), 'Extension menu settings must not expose the old Provider Settings dropdown.');
assert(!settingsTemplate.includes('API and model controls'), 'Extension menu settings must not expose legacy API/model controls.');
assert(!panel.includes('Drop support is queued'), 'Loredeck Library must not expose queued drop-support placeholder copy.');
assert(!panel.includes("['contents', 'Contents'"), 'Loredeck Library details must not expose the low-value Contents tab.');
assert(!panel.includes("['activation', 'Activation'"), 'Loredeck Library details must not expose the low-value Activation tab.');
assert(panel.includes('LOREDECK_CREATOR_ENTRY_BATCH_SIZE = 3'), 'Creator entry drafting must keep the default micro-batch size small.');
assert(panel.includes('Draft Next Batch'), 'Creator entry drafting must expose a one-batch action.');
assert(panel.includes('Draft ${LOREDECK_CREATOR_ENTRY_AUTORUN_BATCHES} Batches'), 'Creator entry drafting must expose a bounded multi-batch action.');
assert(assistant.includes('currentMicroBatchOnly'), 'Creator entry prompt context must mark entry drafting as a micro-batch.');

assert(fixture.bundleType === 'saga_loredeck_json', 'Fixture must be a Saga Loredeck bundle.');
assert(fixture.pack?.packId === 'smoke-arlong-park', 'Fixture pack ID must match the harness deck.');
assert(fixture.manifest?.id === fixture.pack.packId, 'Fixture manifest ID must match the pack ID.');
assert(fixture.pack?.version === '1.0.1', 'Fixture should simulate a newer published version.');
assert(Array.isArray(fixture.entries) && fixture.entries.length >= 2, 'Fixture must include embedded Lorecards.');
for (const entry of fixture.entries) {
    assert(entry.schemaVersion === 3, `Fixture entry ${entry.id || '(missing id)'} must use schema v3.`);
    assert(entry.id && entry.title, 'Fixture entries need IDs and titles.');
    assert(entry.content?.fact && entry.content?.injection, `Fixture entry ${entry.id} needs high-value content fields.`);
    assert(entry.context && typeof entry.context === 'object', `Fixture entry ${entry.id} needs Context metadata.`);
    assert(entry.retrieval && typeof entry.retrieval === 'object', `Fixture entry ${entry.id} needs retrieval metadata.`);
}
assert(fixture.timelineRegistry?.anchors?.length, 'Fixture must include timeline anchors.');
assert(fixture.tagRegistry?.tags?.length, 'Fixture must include tag definitions.');

for (const token of [
    'Check Updates',
    'Loredeck Update Preview',
    'Update This Deck',
    'Install As New Copy',
    'Pending Review',
    'Loredeck Creator',
    'Open Loredeck Library',
    'Loredeck Library',
    'Add to Stack >',
    'Clear Stack',
    'Deck Health Center',
    'Open Health Center',
    'Run Validation',
    'Duplicate',
    'Delete',
    'deleteLoredeckLibraryPackWithConfirm',
    'deleteLoredeckLibraryPacksWithConfirm',
    'moveLoredecksToLibraryFolder',
    'folderDropTarget',
    'createLoredeckLibraryHierarchyList',
    'createLoredeckLibraryInlineFolderRow',
    'createLoredeckLibraryFolderCoverStrip',
    'updateLoredeckLibraryFolderCoverStrip',
    'createLoredeckLibraryFolderDetailsPanel',
    'createLoredeckLibraryFolderLoredeckRow',
    'loredeckLibrarySelectedFolderDetailsId',
    'wandlight-grip-dot-rows',
    'Expand Details',
    'refreshLoredeckSurfaces',
    'LOREDECK_INDEX_URL',
    'createLoredeckLibraryHeaderMeta',
    'createLoredeckLibrarySquareIconAction',
    'renderSettingsTab',
    'ICONSET_SCHEMA_VERSION',
    'BUNDLED_ICONSET_PRESETS',
    'saga-hero',
    'Images/iconsets/saga-hero/saga-tab-loredecks-256.png',
    'saga-gold',
    'Images/iconsets/saga-gold/256/loredecks.png',
    'createThemeIconSetSelector',
    'applyThemeIconSet',
    'createLoredeckDeckVisual',
    'assets.cover',
    'Theme Pack',
    'Installed Theme Packs',
    'Royal Chronicle',
    'Grimoire Crimson',
    'Stellar Cartography',
    'Neon District',
    'Hero Campus',
    'Sea Map Odyssey',
    'Monster Index',
    'Holo Rail',
    'Midnight Evidence',
    'Shelf Icon Set',
    'Color Overrides',
]) {
    assert(panel.includes(token), `Runtime panel is missing expected smoke token: ${token}`);
}

for (const token of [
    'wandlight-loredeck-install-shell',
    'wandlight-runtime-rail',
    'wandlight-runtime-drawer',
    'wandlight-loredeck-library-details',
    'wandlight-loredeck-library-resize-handle',
    'wandlight-loredeck-library-resize-track-left',
    'wandlight-loredeck-library-resize-label-arrow',
    'wandlight-loredeck-metadata-shell',
    'wandlight-loredeck-library-shell',
    'wandlight-loredeck-library-columns',
    'wandlight-loredeck-library-hierarchy-list',
    'wandlight-loredeck-library-title-meta',
    'wandlight-loredeck-library-details-collapsed',
    'wandlight-loredeck-library-inline-folder-row',
    'wandlight-loredeck-library-folder-cover-strip',
    'wandlight-loredeck-library-folder-cover-tile',
    'wandlight-loredeck-library-folder-row-drop-enabled',
    'wandlight-loredeck-library-current-view',
    'wandlight-loredeck-library-transfer-footer',
    'wandlight-loredeck-library-stack-card',
    'wandlight-loredeck-library-stack-grip',
    'wandlight-loredeck-library-stack-ghost',
    'wandlight-loredeck-library-center-actions',
    'wandlight-loredeck-library-square-action',
    'wandlight-loredeck-library-icon-action',
    'wandlight-loredeck-library-stack-toggle-button',
    'wandlight-lore-workbench-shell .wandlight-runtime-button',
    'wandlight-loredeck-health-center-shell',
    'wandlight-loredeck-health-severity-card',
    'wandlight-theme-top-grid',
    'wandlight-theme-gallery',
    'wandlight-theme-iconset-selector',
    'wandlight-theme-iconset-strip',
    'wandlight-theme-icon-grid',
    'wandlight-loredeck-library-visual-cover',
    'wandlight-loredeck-library-visual-cover::after',
    'border-radius: inherit',
    'scrollbar-gutter: stable',
]) {
    assert(style.includes(token), `Stylesheet is missing expected smoke selector: ${token}`);
}

console.log('Visual smoke harness contract passed.');
