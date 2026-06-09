import {
    getSettings,
    saveSettings,
    getThemePackLibraryRegistry,
    upsertThemeIconSetLibraryPack,
    upsertThemePackLibraryPack,
    removeThemePackLibraryPack,
    importThemeIconSetLibraryRegistry,
    importThemePackLibraryRegistry,
} from './state-manager.js';
import {
    confirmAction,
    createButton,
    toast,
    wireOverlayBackdropClose,
} from './runtime-ui-kit.js';
import {
    DEFAULT_ICONSET_ID,
    THEMEPACK_PRESETS,
    applyRuntimeTheme,
    completeThemeColors,
    getActiveThemeColors,
    getIconSetLibrary,
    getIconSetPreset,
    getThemePackLibrary,
    getThemePreset,
    writeThemeColorsToSettings,
} from './runtime-theme.js';
import {
    createActiveThemePanel,
    createThemeIconSetPanel,
    getThemeIconCoverage,
} from './theme-panel.js';

let themeActionDeps = {};

export function configureThemeActions(deps = {}) {
    themeActionDeps = { ...themeActionDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = themeActionDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Theme actions dependency is not configured: ${name}`);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function refreshPanelBody(options = {}) {
    return dep('refreshPanelBody', () => null)(options);
}

function refreshHeader() {
    return dep('refreshHeader', () => null)();
}

function refreshRuntimeRailIcons(settings = getSettings()) {
    return dep('refreshRuntimeRailIcons', () => null)(settings);
}

function downloadJson(data, filename) {
    return dep('downloadJson', defaultDownloadJson)(data, filename);
}

function getThemeShelfIconItems() {
    return dep('getThemeShelfIconItems', () => [])();
}

export function createThemePanelOptions() {
    const iconItems = getThemeShelfIconItems();
    return {
        onApplyThemePreset: applyThemePreset,
        onForgetThemePack: forgetThemePack,
        onImportThemePack: importThemePackFromFile,
        onImportIconSet: importThemeIconSetFromFile,
        onApplyThemeIconSet: applyThemeIconSet,
        onEnableColorOverrides: enableThemeOverrides,
        onResetThemeOverrides: resetThemeOverrides,
        onExportActiveThemePack: exportActiveThemePack,
        onColorInput: updateThemeColorInput,
        onColorChange: () => refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true }),
        onShowRawColorTokens: data => openThemeJsonDialog('Resolved Color Tokens', data),
        onShowThemeJson: (activePreset, settings) => openThemeJsonDialog('Theme Pack JSON', buildThemePackExportObject(activePreset, settings)),
        onExportThemePackLibrary: exportThemePackLibrary,
        onResetThemeSettings: resetThemeSettings,
        iconItems,
        getIconCoverage: iconSet => getThemeIconCoverage(iconSet, getSettings(), getThemeShelfIconItems()),
    };
}

export function enableThemeOverrides(activePreset = getThemePreset(getSettings().themePackId)) {
    const next = getSettings();
    next.themeCustomEnabled = true;
    writeThemeColorsToSettings(next, completeThemeColors(activePreset?.colors || {}));
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast('Color overrides enabled.', 'info');
}

export function resetThemeOverrides() {
    const settings = getSettings();
    const preset = getThemePreset(settings.themePackId, settings);
    const next = getSettings();
    next.themeCustomEnabled = false;
    writeThemeColorsToSettings(next, preset.colors || {});
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    toast('Theme overrides reset.', 'info');
}

export function updateThemeColorInput(settingKey, colorValue) {
    const next = getSettings();
    next.themeCustomEnabled = true;
    next[settingKey] = colorValue;
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
}

export function importThemeIconSetFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
            if (!file) return;
            try {
                const parsed = JSON.parse(await file.text());
                if (parsed?.iconSets && typeof parsed.iconSets === 'object' && !Array.isArray(parsed.iconSets)) {
                    const result = importThemeIconSetLibraryRegistry(parsed, { replace: false });
                    if (!result.ok) throw new Error(result.error || 'Icon Set import failed.');
                    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                    const skipped = result.skippedCount ? ` Skipped ${result.skippedCount} bundled-id conflict(s).` : '';
                    toast(`Imported ${result.importedCount || 0} Icon Set record(s).${skipped}`, result.skippedCount ? 'warning' : 'success');
                    return;
                }
                const icons = parsed?.icons && typeof parsed.icons === 'object' && !Array.isArray(parsed.icons)
                    ? parsed.icons
                    : parsed;
                if (!icons || typeof icons !== 'object' || Array.isArray(icons)) throw new Error('Icon Set import must be a JSON object with an icons object or iconSets registry.');
                const id = normalizeIconSetImportId(parsed.id || parsed.iconSetId || parsed.iconPackId || parsed.title || file.name || 'custom-icon-set');
                const result = upsertThemeIconSetLibraryPack({
                    id,
                    type: 'custom',
                    title: parsed.title || id,
                    description: parsed.description || `Icon Set imported from ${file.name}.`,
                    author: parsed.author || '',
                    version: parsed.version || '1.0.0',
                    preferredSize: parsed.preferredSize || 256,
                    icons,
                    tags: Array.isArray(parsed.tags) ? parsed.tags : ['icons:custom'],
                    source: { kind: 'local', url: file.name },
                });
                if (!result.ok) throw new Error(result.error || 'Icon Set import failed.');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                toast(`Imported Icon Set: ${result.iconSet.title}. Use the Icon Set selector to activate it.`, 'success');
        } catch (e) {
            toast(e?.message || 'Icon Set import failed.', 'error');
        }
    }, { once: true });
    input.click();
}

function normalizeThemeImportId(value = '') {
    const base = String(value || 'custom-theme')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'custom-theme';
    const existing = new Set(getThemePackLibrary(getSettings()).map(theme => theme.id));
    if (!existing.has(base) && !THEMEPACK_PRESETS.some(theme => theme.id === base)) return base;
    let index = 2;
    while (existing.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

function normalizeIconSetImportId(value = '') {
    const base = String(value || 'custom-icon-set')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'custom-icon-set';
    const existing = new Set(getIconSetLibrary(getSettings()).map(iconSet => iconSet.id));
    if (!existing.has(base)) return base;
    let index = 2;
    while (existing.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
}

export function buildThemePackExportObject(preset, settings = getSettings()) {
    const colors = preset?.id === settings.themePackId ? getActiveThemeColors(settings) : completeThemeColors(preset?.colors || {});
    const isCustomOverride = preset?.id === settings.themePackId && settings.themeCustomEnabled === true;
    return {
        schemaVersion: 1,
        id: isCustomOverride && preset?.type !== 'custom' ? `${preset.id}-custom` : (preset?.id || 'saga-theme'),
        type: 'custom',
        title: isCustomOverride && preset?.type !== 'custom' ? `${preset.title} Custom` : (preset?.title || 'Saga Theme'),
        description: preset?.description || 'Custom Theme Pack exported from Saga.',
        author: preset?.author || '',
        version: preset?.version || '1.0.0',
        colors,
        tags: Array.isArray(preset?.tags)
            ? preset.tags.filter(tag => !['quality:bundled', 'theme:icon-set', 'icons:custom'].includes(tag))
            : [],
    };
}

export function openThemeJsonDialog(titleText, data) {
    const overlay = document.createElement('div');
    overlay.className = 'wandlight-new-lore-overlay wandlight-theme-json-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'wandlight-new-lore-shell wandlight-theme-json-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'wandlight-new-lore-header';
    const title = document.createElement('h3');
    title.textContent = titleText || 'Theme JSON';
    header.appendChild(title);
    header.appendChild(createButton('Close', 'Close this Theme JSON viewer.', () => overlay.remove()));
    shell.appendChild(header);

    const text = document.createElement('textarea');
    text.className = 'wandlight-lore-editor-textarea wandlight-theme-json-textarea';
    text.readOnly = true;
    text.value = JSON.stringify(data || {}, null, 2);
    shell.appendChild(text);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    actions.appendChild(createButton('Copy JSON', 'Copy this JSON to clipboard.', async () => {
        await navigator.clipboard?.writeText(text.value);
        toast('Theme JSON copied.', 'info');
    }));
    shell.appendChild(actions);
}

export function refreshThemeIconSetSurfaces(settings = getSettings()) {
    const card = getPanelRoot()?.querySelector('.wandlight-settings-theme-card');
    if (!card) return false;
    const activePreset = getThemePreset(settings.themePackId, settings);
    const colors = getActiveThemeColors(settings);
    const activePanel = card.querySelector('.wandlight-theme-active-panel');
    if (activePanel) activePanel.replaceWith(createActiveThemePanel(activePreset, settings, colors, createThemePanelOptions()));
    const iconPanel = card.querySelector('.wandlight-theme-icon-panel');
    if (iconPanel) iconPanel.replaceWith(createThemeIconSetPanel(activePreset, settings, createThemePanelOptions()));
    return !!(activePanel || iconPanel);
}

export function applyThemeIconSet(iconPackId = DEFAULT_ICONSET_ID) {
    const iconSet = getIconSetPreset(iconPackId);
    const next = getSettings();
    next.themeIconPackId = iconSet.id || DEFAULT_ICONSET_ID;
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
    refreshRuntimeRailIcons(next);
    refreshThemeIconSetSurfaces(next);
    refreshHeader();
    toast(`Icon Set set to ${iconSet.title || iconSet.id}.`, 'success');
}

export function applyThemePreset(themeId) {
    const current = getSettings();
    const preset = getThemePreset(themeId, current);
    const next = getSettings();
    next.themePackId = preset.id;
    writeThemeColorsToSettings(next, preset.colors || {});
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    toast(`Themepack set to ${preset.title}.`, 'success');
}

export function resetThemeSettings() {
    const preset = THEMEPACK_PRESETS[0];
    const next = getSettings();
    next.themePackId = preset.id;
    next.themeCustomEnabled = false;
    writeThemeColorsToSettings(next, preset.colors || {});
    saveSettings(next);
    applyRuntimeTheme(getPanelRoot(), next);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    toast('Theme reset.', 'info');
}

export function exportActiveThemePack() {
    const settings = getSettings();
    const preset = getThemePreset(settings.themePackId, settings);
    const themePack = buildThemePackExportObject(preset, settings);
    downloadJson(themePack, `${sanitizeFileStem(themePack.id || 'saga-theme')}.theme.json`);
    toast('Active Theme Pack exported.', 'info');
}

export function exportThemePackLibrary() {
    const settings = getSettings();
    const library = settings.themePackLibrary || getThemePackLibraryRegistry();
    downloadJson(library, 'saga-theme-pack-library.json');
    toast('Theme Pack Library exported.', 'info');
}

export function importThemePackFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Theme Pack import must be a JSON object.');
            }
            if (parsed.iconSets || parsed.type === 'saga_iconset' || (parsed.icons && !parsed.colors && !parsed.packs)) {
                throw new Error('This looks like an Icon Set. Use Import Icon Set instead.');
            }

            if (parsed.packs && typeof parsed.packs === 'object') {
                const result = importThemePackLibraryRegistry(parsed, { replace: false });
                if (!result.ok) throw new Error(result.error || 'Import failed.');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                const skipped = result.skippedCount ? ` Skipped ${result.skippedCount} bundled-id conflict(s).` : '';
                toast(`Imported ${result.importedCount || 0} Theme Pack record(s).${skipped}`, result.skippedCount ? 'warning' : 'success');
                return;
            }

            const result = upsertThemePackLibraryPack({ ...parsed, id: normalizeThemeImportId(parsed.id || parsed.themeId || parsed.title || 'custom-theme'), type: 'custom' });
            if (!result.ok) throw new Error(result.error || 'Import failed.');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(`Installed Theme Pack: ${result.pack.title}. Use Apply to activate it.`, 'success');
        } catch (e) {
            toast(e?.message || 'Theme Pack import failed.', 'error');
        }
    }, { once: true });
    input.click();
}

export async function forgetThemePack(themeId) {
    const pack = getThemePreset(themeId, getSettings());
    const ok = await confirmAction(
        'Forget Theme Pack',
        `Remove "${pack.title || themeId}" from installed Custom Theme Packs?`
    );
    if (!ok) return;
    const result = removeThemePackLibraryPack(themeId);
    if (!result.ok) {
        toast(result.error || 'Theme Pack could not be removed.', 'error');
        return;
    }
    const settings = getSettings();
    if (settings.themePackId === themeId) {
        resetThemeSettings();
    } else {
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    }
    toast('Theme Pack forgotten.', 'info');
}

function defaultDownloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sanitizeFileStem(value) {
    const text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return text || 'saga-export';
}
