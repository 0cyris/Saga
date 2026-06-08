import {
    addTooltip,
    createButton,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
} from './runtime-ui-kit.js';
import {
    buildThemeAccessibilityReport,
    completeThemeColors,
    DEFAULT_ICONSET_ID,
    formatContrastRatio,
    getActiveThemeColors,
    getIconMapValue,
    getIconSetLibrary,
    getIconSetPreset,
    getLocalAssetSrc,
    normalizePassiveAssetPath,
    normalizeHexColor,
    resolveThemeIconPath,
    THEME_COLOR_FIELDS,
} from './runtime-theme.js';

export function createThemeEmblem(preset, colors, options = {}) {
    const emblem = document.createElement('div');
    emblem.className = `wandlight-theme-emblem${options.large ? ' wandlight-theme-emblem-large' : ''}`;
    applyThemePreviewVariables(emblem, colors);
    const initials = String(preset?.title || preset?.id || 'SAGA')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || 'S';
    emblem.textContent = initials;
    addTooltip(emblem, `${preset?.title || 'Theme'} visual marker.`);
    return emblem;
}

export function createThemeSwatchStrip(colors = {}) {
    const strip = document.createElement('div');
    strip.className = 'wandlight-theme-swatch-strip';
    for (const key of ['background', 'surface', 'accent', 'borderStrong', 'button', 'text']) {
        const swatch = document.createElement('span');
        swatch.style.background = normalizeHexColor(colors[key], '#000000');
        addTooltip(swatch, `${humanizeScopeKey(key)}: ${normalizeHexColor(colors[key], '#000000')}`);
        strip.appendChild(swatch);
    }
    return strip;
}

export function applyThemePreviewVariables(el, colors = {}) {
    if (!el?.style) return el;
    const complete = completeThemeColors(colors);
    el.style.setProperty('--theme-preview-bg', complete.background);
    el.style.setProperty('--theme-preview-bg-alt', complete.backgroundAlt);
    el.style.setProperty('--theme-preview-surface', complete.surface);
    el.style.setProperty('--theme-preview-surface-alt', complete.surfaceAlt);
    el.style.setProperty('--theme-preview-border', complete.border);
    el.style.setProperty('--theme-preview-border-strong', complete.borderStrong);
    el.style.setProperty('--theme-preview-accent', complete.accent);
    el.style.setProperty('--theme-preview-danger', complete.danger);
    el.style.setProperty('--theme-preview-success', complete.success);
    el.style.setProperty('--theme-preview-warning', complete.warning);
    el.style.setProperty('--theme-preview-focus', complete.focus);
    el.style.setProperty('--theme-preview-button', complete.button);
    el.style.setProperty('--theme-preview-button-hover', complete.buttonHover);
    el.style.setProperty('--theme-preview-button-text', complete.buttonText);
    el.style.setProperty('--theme-preview-input', complete.input);
    el.style.setProperty('--theme-preview-input-border', complete.inputBorder);
    el.style.setProperty('--theme-preview-text', complete.text);
    el.style.setProperty('--theme-preview-muted', complete.mutedText);
    return el;
}

export function getThemeStyleLabel(preset = {}) {
    const tags = Array.isArray(preset?.tags) ? preset.tags : [];
    const styleTag = tags.find(tag => /^style:/i.test(tag));
    if (styleTag) return humanizeScopeKey(styleTag.replace(/^style:/i, ''));
    if (tags.some(tag => /^theme:dark/i.test(tag))) return 'Dark';
    return 'Theme';
}

export function getThemeSourceLabel(preset = {}) {
    const source = preset?.source && typeof preset.source === 'object' && !Array.isArray(preset.source) ? preset.source : {};
    if (source.kind) return humanizeScopeKey(source.kind);
    return preset?.type === 'custom' ? 'Custom' : 'Bundled';
}

export function createActiveThemePanel(activePreset, settings = {}, colors = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'wandlight-theme-panel wandlight-theme-active-panel';

    const label = document.createElement('div');
    label.className = 'wandlight-runtime-card-title';
    label.textContent = 'Active Theme';
    panel.appendChild(label);

    const body = document.createElement('div');
    body.className = 'wandlight-theme-active-body';
    body.appendChild(createThemeEmblem(activePreset, colors, { large: true }));

    const main = document.createElement('div');
    main.className = 'wandlight-theme-active-main';
    const title = document.createElement('div');
    title.className = 'wandlight-theme-active-title';
    title.textContent = activePreset?.title || 'SAGA Archive';
    main.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(activePreset?.type === 'custom' ? 'Custom' : 'Bundled', 'Theme Pack source type.'));
    chips.appendChild(createStatusPill(getThemeStyleLabel(activePreset), 'Theme Pack style tags.'));
    chips.appendChild(createStatusPill('JSON-only', 'Theme Packs are data-only and cannot run code.'));
    main.appendChild(chips);
    const description = document.createElement('div');
    description.className = 'wandlight-theme-description';
    description.textContent = activePreset?.description || 'Dark archive interface with gold accents and maroon surfaces.';
    main.appendChild(description);

    const summary = document.createElement('div');
    summary.className = 'wandlight-theme-pack-summary';
    summary.appendChild(createKeyValue('Theme ID', activePreset?.id || 'wandlight-default', 'Stable Theme Pack identifier.'));
    summary.appendChild(createKeyValue('Version', activePreset?.version || 'unset', 'Theme Pack version metadata.'));
    summary.appendChild(createKeyValue('Source', activePreset?.type === 'custom' ? getThemeSourceLabel(activePreset) : 'Bundled', 'Where this Theme Pack came from.'));
    const activeIconSet = getIconSetPreset(settings.themeIconPackId || activePreset?.iconPackId || DEFAULT_ICONSET_ID, settings);
    summary.appendChild(createKeyValue('Icon Set', activeIconSet.title || activeIconSet.id, 'Reusable runtime icon set selected for the active Theme Pack.'));
    summary.appendChild(createKeyValue('Color overrides', settings.themeCustomEnabled === true ? 'On' : 'Off', 'Overrides are user changes layered over the selected Theme Pack.'));
    summary.appendChild(createKeyValue('Icon overrides', Object.keys(activePreset?.icons || {}).length ? 'On' : 'Off', 'Theme Pack icon path overrides such as tab.loredecks or brand.expanded.'));
    main.appendChild(summary);

    if (activePreset?.type === 'custom' && typeof options.onForgetThemePack === 'function') {
        const actions = document.createElement('div');
        actions.className = 'wandlight-primary-actions';
        actions.appendChild(createButton('Forget Theme Pack', 'Remove this Custom Theme Pack from installed settings.', async () => {
            await options.onForgetThemePack(activePreset.id);
        }, 'wandlight-danger-button'));
        main.appendChild(actions);
    }

    body.appendChild(main);
    panel.appendChild(body);
    return panel;
}

export function createInstalledThemePackGallery(themeLibrary = [], activePreset, settings = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'wandlight-theme-panel wandlight-theme-gallery-panel';
    const header = document.createElement('div');
    header.className = 'wandlight-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Installed Theme Packs';
    header.appendChild(title);
    header.appendChild(createStatusPill(`${themeLibrary.length} installed`, 'Bundled and Custom Theme Packs available in this settings profile.'));
    panel.appendChild(header);

    const gallery = document.createElement('div');
    gallery.className = 'wandlight-theme-gallery';
    for (const preset of themeLibrary) {
        gallery.appendChild(createThemePackGalleryCard(preset, activePreset, settings, options));
    }
    gallery.appendChild(createThemeImportTile(options));
    panel.appendChild(gallery);
    return panel;
}

function createThemePackGalleryCard(preset, activePreset, settings = {}, options = {}) {
    const colors = preset.id === settings.themePackId ? getActiveThemeColors(settings) : completeThemeColors(preset.colors || {});
    const report = buildThemeAccessibilityReport(colors);
    const isActive = preset.id === activePreset?.id;
    const card = document.createElement('div');
    card.className = `wandlight-theme-pack-card${isActive ? ' wandlight-theme-pack-card-active' : ''}`;
    card.appendChild(createThemeEmblem(preset, colors));
    const main = document.createElement('div');
    main.className = 'wandlight-theme-pack-card-main';
    const title = document.createElement('div');
    title.className = 'wandlight-theme-pack-card-title';
    title.textContent = preset.title || preset.id;
    main.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(preset.type === 'custom' ? 'Custom' : 'Bundled', 'Theme Pack source type.'));
    chips.appendChild(createStatusPill(getThemeStyleLabel(preset), 'Theme style metadata.'));
    main.appendChild(chips);
    main.appendChild(createThemeSwatchStrip(colors));
    const status = document.createElement('div');
    status.className = `wandlight-theme-pack-accessibility ${report.failedCount ? 'wandlight-theme-pack-accessibility-warning' : ''}`;
    status.textContent = `Accessibility: ${report.status}`;
    main.appendChild(status);
    const coverage = typeof options.getIconCoverage === 'function'
        ? options.getIconCoverage(preset)
        : { loaded: 0, total: 0 };
    const iconStatus = document.createElement('div');
    iconStatus.className = 'wandlight-theme-pack-icon-status';
    iconStatus.textContent = `Icons: ${coverage.loaded || 0} / ${coverage.total || 0}`;
    main.appendChild(iconStatus);
    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    const apply = createButton(isActive ? 'Active' : 'Apply', isActive ? 'This Theme Pack is active.' : 'Apply this Theme Pack.', () => {
        options.onApplyThemePreset?.(preset.id);
    }, isActive ? 'wandlight-primary-button' : '');
    apply.disabled = isActive;
    actions.appendChild(apply);
    main.appendChild(actions);
    card.appendChild(main);
    return card;
}

function createThemeImportTile(options = {}) {
    const tile = document.createElement('div');
    tile.className = 'wandlight-theme-import-tile';
    const icon = document.createElement('div');
    icon.className = 'wandlight-theme-import-icon';
    icon.textContent = '+';
    tile.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'wandlight-theme-pack-card-title';
    title.textContent = 'Import Theme Pack';
    tile.appendChild(title);
    const help = document.createElement('div');
    help.className = 'wandlight-runtime-help';
    help.textContent = 'Import a JSON Theme Pack to add it to your library.';
    tile.appendChild(help);
    tile.appendChild(createButton('Import', 'Choose a Theme Pack JSON file.', () => {
        options.onImportThemePack?.();
    }));
    return tile;
}

export function createThemeIconSetPanel(activePreset, settings = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'wandlight-theme-panel wandlight-theme-icon-panel';
    const iconSet = getIconSetPreset(settings.themeIconPackId || activePreset?.iconPackId || DEFAULT_ICONSET_ID, settings);
    const iconItems = Array.isArray(options.iconItems) ? options.iconItems : [];
    const coverage = getThemeIconCoverage(activePreset, settings, iconItems);
    const header = document.createElement('div');
    header.className = 'wandlight-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Shelf Icon Set';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Current: ${iconSet.title || iconSet.id}`, 'Current reusable Icon Set metadata selected by the active Theme Pack.'));
    panel.appendChild(header);

    const status = document.createElement('div');
    status.className = 'wandlight-theme-icon-status';
    status.textContent = `${coverage.loaded} / ${coverage.total} icon paths available | ${coverage.missing} using text fallback | ${coverage.invalid} invalid paths`;
    panel.appendChild(status);

    panel.appendChild(createThemeIconSetSelector(iconSet, settings, options));

    const grid = document.createElement('div');
    grid.className = 'wandlight-theme-icon-grid';
    for (const item of iconItems) {
        const tile = document.createElement('div');
        tile.className = 'wandlight-theme-icon-tile';
        const icon = document.createElement('div');
        icon.className = 'wandlight-theme-icon-preview';
        const path = getThemeIconPreviewPath(activePreset, item, settings);
        if (path) {
            const img = document.createElement('img');
            img.src = getLocalAssetSrc(path);
            img.alt = item.label;
            img.addEventListener('error', () => {
                img.remove();
                icon.textContent = item.fallback;
            }, { once: true });
            icon.appendChild(img);
        } else {
            icon.textContent = item.fallback;
        }
        tile.appendChild(icon);
        const label = document.createElement('div');
        label.textContent = item.label;
        tile.appendChild(label);
        addTooltip(tile, path ? `${item.label}: ${path}` : `${item.label}: icon set fallback.`);
        grid.appendChild(tile);
    }
    panel.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    actions.appendChild(createButton('Import Icon Set', 'Import icon mappings as a Custom Theme Pack that inherits the active colors.', () => {
        options.onImportIconSet?.();
    }));
    actions.appendChild(createButton('Reset to Theme Icons', 'Reapply the active Theme Pack default Icon Set.', () => {
        options.onApplyThemeIconSet?.(activePreset?.iconPackId || DEFAULT_ICONSET_ID);
    }));
    actions.appendChild(createButton('Reset to Default', 'Switch to the bundled Saga Hero Icon Set.', () => {
        options.onApplyThemeIconSet?.(DEFAULT_ICONSET_ID);
    }));
    panel.appendChild(actions);

    const mapping = document.createElement('details');
    mapping.className = 'wandlight-theme-advanced-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced Icon Mapping';
    mapping.appendChild(summary);
    const rows = document.createElement('div');
    rows.className = 'wandlight-theme-icon-mapping';
    for (const item of iconItems) {
        rows.appendChild(createKeyValue(item.label, getThemeIconPreviewPath(activePreset, item, settings) || 'icon set fallback', 'Icon mapping path used by this Theme Pack preview.'));
    }
    mapping.appendChild(rows);
    panel.appendChild(mapping);
    return panel;
}

function createThemeIconSetSelector(activeIconSet = getIconSetPreset(DEFAULT_ICONSET_ID), settings = {}, options = {}) {
    const iconSets = getIconSetLibrary(settings);
    const shell = document.createElement('div');
    shell.className = 'wandlight-theme-iconset-selector';

    const row = document.createElement('label');
    row.className = 'wandlight-theme-iconset-select-row';
    const label = document.createElement('span');
    label.textContent = 'Icon Set';
    addTooltip(label, 'Switch the runtime shelf tab icon library without changing colors or the active Theme Pack.');
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'wandlight-lore-workbench-select wandlight-theme-iconset-select';
    for (const iconSet of iconSets) {
        const option = document.createElement('option');
        option.value = iconSet.id;
        option.textContent = iconSet.title || iconSet.id;
        if (iconSet.id === activeIconSet.id) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => options.onApplyThemeIconSet?.(select.value));
    row.appendChild(select);
    shell.appendChild(row);

    const strip = document.createElement('div');
    strip.className = 'wandlight-theme-iconset-strip';
    for (const iconSet of iconSets) {
        const active = iconSet.id === activeIconSet.id;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `wandlight-theme-iconset-card${active ? ' wandlight-theme-iconset-card-active' : ''}`;
        card.disabled = active;
        addTooltip(card, active ? `${iconSet.title} is active.` : `Switch to ${iconSet.title}.`);
        card.addEventListener('click', () => options.onApplyThemeIconSet?.(iconSet.id));

        const preview = document.createElement('div');
        preview.className = 'wandlight-theme-iconset-preview-row';
        for (const iconKey of ['tab.loredecks', 'tab.context', 'tab.lore', 'tab.settings']) {
            const path = getIconMapValue(iconSet.icons, iconKey);
            const cell = document.createElement('span');
            if (path) {
                const img = document.createElement('img');
                img.src = getLocalAssetSrc(path);
                img.alt = iconKey;
                img.addEventListener('error', () => {
                    img.remove();
                    cell.textContent = iconKey.split('.').pop()?.slice(0, 1).toUpperCase() || '?';
                }, { once: true });
                cell.appendChild(img);
            } else {
                cell.textContent = iconKey.split('.').pop()?.slice(0, 1).toUpperCase() || '?';
            }
            preview.appendChild(cell);
        }
        card.appendChild(preview);

        const title = document.createElement('strong');
        title.textContent = iconSet.title || iconSet.id;
        card.appendChild(title);
        const meta = document.createElement('small');
        meta.textContent = active ? 'Active' : 'Switch';
        card.appendChild(meta);
        strip.appendChild(card);
    }
    shell.appendChild(strip);
    return shell;
}

export function createThemeColorOverridesPanel(settings = {}, activePreset, colors = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'wandlight-theme-panel wandlight-theme-overrides-panel';
    const header = document.createElement('div');
    header.className = 'wandlight-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Color Overrides';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Overrides: ${settings.themeCustomEnabled === true ? 'On' : 'Off'}`, 'Overrides are user color changes layered over the Theme Pack.'));
    panel.appendChild(header);

    if (settings.themeCustomEnabled !== true) {
        const empty = document.createElement('div');
        empty.className = 'wandlight-theme-overrides-empty';
        const emblem = document.createElement('div');
        emblem.className = 'wandlight-theme-header-icon';
        emblem.textContent = 'C';
        empty.appendChild(emblem);
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = 'Using pack defaults.';
        text.appendChild(title);
        const help = document.createElement('div');
        help.className = 'wandlight-runtime-help';
        help.textContent = 'Enable overrides to customize this theme without editing the original pack.';
        text.appendChild(help);
        empty.appendChild(text);
        panel.appendChild(empty);
        const actions = document.createElement('div');
        actions.className = 'wandlight-primary-actions';
        actions.appendChild(createButton('Enable Color Overrides', 'Enable editable color overrides layered on top of this Theme Pack.', () => {
            options.onEnableColorOverrides?.(activePreset);
        }, 'wandlight-primary-button'));
        panel.appendChild(actions);
        return panel;
    }

    panel.appendChild(createThemeColorGroup('Core Palette', colors, [
        ['Background', 'themeBackgroundColor', 'background'],
        ['Surface', 'themeSurfaceColor', 'surface'],
        ['Border', 'themeBorderColor', 'border'],
        ['Accent', 'themeAccentColor', 'accent'],
        ['Text', 'themeTextColor', 'text'],
        ['Muted Text', 'themeMutedTextColor', 'mutedText'],
    ], options));
    panel.appendChild(createThemeColorGroup('State Colors', colors, [
        ['Success', 'themeSuccessColor', 'success'],
        ['Warning', 'themeWarningColor', 'warning'],
        ['Danger', 'themeDangerColor', 'danger'],
        ['Focus Ring', 'themeFocusColor', 'focus'],
    ], options));
    panel.appendChild(createThemeColorGroup('Controls', colors, [
        ['Button', 'themeButtonColor', 'button'],
        ['Button Hover', 'themeButtonHoverColor', 'buttonHover'],
        ['Input', 'themeInputColor', 'input'],
        ['Input Border', 'themeInputBorderColor', 'inputBorder'],
    ], options));

    const advanced = document.createElement('details');
    advanced.className = 'wandlight-theme-advanced-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced Tokens';
    advanced.appendChild(summary);
    const grid = document.createElement('div');
    grid.className = 'wandlight-theme-color-grid';
    for (const [label, settingKey, colorKey] of THEME_COLOR_FIELDS) {
        grid.appendChild(createThemeColorField(label, settingKey, colors[colorKey], true, options));
    }
    advanced.appendChild(grid);
    panel.appendChild(advanced);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    actions.appendChild(createButton('Reset Color Overrides', 'Disable overrides and restore this Theme Pack colors.', () => {
        options.onResetThemeOverrides?.();
    }));
    actions.appendChild(createButton('Export as Custom Theme', 'Export active colors as a Custom Theme Pack JSON file.', () => {
        options.onExportActiveThemePack?.();
    }));
    panel.appendChild(actions);
    return panel;
}

function createThemeColorGroup(titleText, colors, fields = [], options = {}) {
    const group = document.createElement('div');
    group.className = 'wandlight-theme-color-group';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = titleText;
    group.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'wandlight-theme-color-grid';
    for (const [label, settingKey, colorKey] of fields) {
        grid.appendChild(createThemeColorField(label, settingKey, colors[colorKey], true, options));
    }
    group.appendChild(grid);
    return group;
}

function createThemeColorField(labelText, settingKey, value, enabled, options = {}) {
    const label = document.createElement('label');
    label.className = 'wandlight-theme-color-field';
    const text = document.createElement('span');
    text.textContent = labelText;
    label.appendChild(text);

    const input = document.createElement('input');
    input.type = 'color';
    input.value = normalizeHexColor(value, '#000000');
    input.disabled = !enabled;
    input.addEventListener('input', () => {
        options.onColorInput?.(settingKey, normalizeHexColor(input.value, '#000000'));
    });
    input.addEventListener('change', () => {
        options.onColorChange?.(settingKey, normalizeHexColor(input.value, '#000000'));
    });
    label.appendChild(input);
    return label;
}

export function createThemeAdvancedPanel(settings = {}, activePreset, colors = {}, options = {}) {
    const panel = document.createElement('details');
    panel.className = 'wandlight-theme-panel wandlight-theme-advanced-panel';
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Advanced';
    summary.appendChild(title);
    const help = document.createElement('span');
    help.className = 'wandlight-runtime-help';
    help.textContent = 'Export raw tokens, inspect theme JSON, and manage diagnostics.';
    summary.appendChild(help);
    panel.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    actions.appendChild(createButton('Show Raw Color Tokens', 'Open all resolved color tokens for this Theme Pack.', () => {
        options.onShowRawColorTokens?.(completeThemeColors(colors));
    }));
    actions.appendChild(createButton('Show Theme JSON', 'Open the active Theme Pack JSON record.', () => {
        options.onShowThemeJson?.(activePreset, settings);
    }));
    actions.appendChild(createButton('Export Theme Library', 'Download installed Custom Theme Pack metadata as JSON.', () => {
        options.onExportThemePackLibrary?.();
    }));
    panel.appendChild(actions);
    return panel;
}

export function getThemeIconPreviewPath(preset = {}, item = {}, settings = {}) {
    return resolveThemeIconPath(item.key, preset, settings)
        || resolveThemeIconPath(item.legacyKey, preset, settings)
        || normalizePassiveAssetPath(item.defaultPath || '');
}

export function getThemeIconCoverage(preset = {}, settings = {}, iconItems = []) {
    const items = Array.isArray(iconItems) ? iconItems : [];
    let loaded = 0;
    let invalid = 0;
    for (const item of items) {
        const path = getThemeIconPreviewPath(preset, item, settings);
        if (path) loaded += 1;
        if (path && !normalizePassiveAssetPath(path)) invalid += 1;
    }
    return {
        total: items.length,
        loaded,
        missing: Math.max(0, items.length - loaded),
        invalid,
    };
}

export function createThemeAccessibilityCard(colors = {}, options = {}) {
    const report = buildThemeAccessibilityReport(colors);
    const shell = document.createElement('div');
    shell.className = `wandlight-theme-accessibility wandlight-theme-accessibility-${report.failedCount ? 'warning' : 'good'}${options.compact ? ' wandlight-theme-accessibility-compact' : ''}`;

    const header = document.createElement('div');
    header.className = 'wandlight-theme-accessibility-header';
    const title = document.createElement('strong');
    title.textContent = 'Accessibility';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Overall: ${report.status}`, 'Theme contrast health is advisory and does not block use.'));
    shell.appendChild(header);

    const help = document.createElement('div');
    help.className = 'wandlight-runtime-help';
    help.textContent = report.failedCount
        ? `${report.failedCount} contrast check${report.failedCount === 1 ? ' is' : 's are'} below the recommended threshold.`
        : 'All required contrast checks pass. Contrast checks use WCAG ratios.';
    shell.appendChild(help);

    const list = document.createElement('div');
    list.className = 'wandlight-theme-accessibility-list';
    const visibleChecks = options.compact
        ? (report.failedCount ? report.checks.filter(check => !check.passes) : [])
        : report.checks;
    for (const check of visibleChecks) {
        list.appendChild(createThemeAccessibilityRow(check));
    }
    shell.appendChild(list);

    if (options.compact && !report.failedCount) {
        const details = document.createElement('details');
        details.className = 'wandlight-theme-advanced-details';
        const summary = document.createElement('summary');
        summary.textContent = 'View Contrast Details';
        details.appendChild(summary);
        const detailList = document.createElement('div');
        detailList.className = 'wandlight-theme-accessibility-list';
        for (const check of report.checks) {
            detailList.appendChild(createThemeAccessibilityRow(check));
        }
        details.appendChild(detailList);
        shell.appendChild(details);
    }
    return shell;
}

function createThemeAccessibilityRow(check = {}) {
    const row = document.createElement('div');
    row.className = `wandlight-theme-accessibility-row ${check.passes ? 'wandlight-theme-accessibility-pass' : 'wandlight-theme-accessibility-fail'}`;

    const main = document.createElement('div');
    main.className = 'wandlight-theme-accessibility-main';
    const label = document.createElement('span');
    label.textContent = check.label || 'Contrast check';
    main.appendChild(label);
    const purpose = document.createElement('small');
    purpose.textContent = check.purpose || '';
    main.appendChild(purpose);
    row.appendChild(main);

    const score = document.createElement('span');
    score.className = 'wandlight-theme-accessibility-score';
    score.textContent = `${formatContrastRatio(check.ratio)} / ${check.target}:1`;
    addTooltip(score, check.passes ? 'Passes the advisory contrast target.' : 'Below the advisory contrast target.');
    row.appendChild(score);
    return row;
}
