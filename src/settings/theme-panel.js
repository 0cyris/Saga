import {
    addTooltip,
    createButton,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
} from '../ui/runtime-ui-kit.js';
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
    THEME_COLOR_FIELDS,
} from '../theme/runtime-theme.js';

export function createThemeEmblem(preset, colors, options = {}) {
    const emblem = document.createElement('div');
    emblem.className = `saga-theme-emblem${options.large ? ' saga-theme-emblem-large' : ''}`;
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
    strip.className = 'saga-theme-swatch-strip';
    for (const key of ['background', 'surface', 'accent', 'danger', 'borderStrong', 'button', 'text']) {
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
    panel.className = 'saga-theme-panel saga-theme-active-panel';

    const label = document.createElement('div');
    label.className = 'saga-runtime-card-title';
    label.textContent = 'Active Theme';
    panel.appendChild(label);

    const body = document.createElement('div');
    body.className = 'saga-theme-active-body';
    body.appendChild(createThemeEmblem(activePreset, colors, { large: true }));

    const main = document.createElement('div');
    main.className = 'saga-theme-active-main';
    const title = document.createElement('div');
    title.className = 'saga-theme-active-title';
    title.textContent = activePreset?.title || 'SAGA Archive';
    main.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(activePreset?.type === 'custom' ? 'Custom' : 'Bundled', 'Theme Pack source type.', { tone: 'source', kind: 'source' }));
    chips.appendChild(createStatusPill(getThemeStyleLabel(activePreset), 'Theme Pack style tags.', { tone: 'tag', kind: 'tag' }));
    chips.appendChild(createStatusPill('JSON-only', 'Theme Packs are data-only and cannot run code.', { tone: 'source', kind: 'source' }));
    main.appendChild(chips);
    const description = document.createElement('div');
    description.className = 'saga-theme-description';
    description.textContent = activePreset?.description || 'Dark archive interface with gold accents and maroon surfaces.';
    main.appendChild(description);

    const summary = document.createElement('div');
    summary.className = 'saga-theme-pack-summary';
    summary.appendChild(createKeyValue('Theme ID', activePreset?.id || 'saga-default', 'Stable Theme Pack identifier.'));
    summary.appendChild(createKeyValue('Version', activePreset?.version || 'unset', 'Theme Pack version metadata.'));
    summary.appendChild(createKeyValue('Source', activePreset?.type === 'custom' ? getThemeSourceLabel(activePreset) : 'Bundled', 'Where this Theme Pack came from.'));
    summary.appendChild(createKeyValue('Color overrides', settings.themeCustomEnabled === true ? 'On' : 'Off', 'Overrides are user changes layered over the selected Theme Pack.'));
    main.appendChild(summary);

    if (activePreset?.type === 'custom' && typeof options.onForgetThemePack === 'function') {
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions';
        actions.appendChild(createButton('Forget Theme Pack', 'Remove this Custom Theme Pack from installed settings.', async () => {
            await options.onForgetThemePack(activePreset.id);
        }, 'saga-danger-button'));
        main.appendChild(actions);
    }

    body.appendChild(main);
    panel.appendChild(body);
    return panel;
}

export function createInstalledThemePackGallery(themeLibrary = [], activePreset, settings = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-theme-panel saga-theme-gallery-panel';
    const header = document.createElement('div');
    header.className = 'saga-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Installed Theme Packs';
    header.appendChild(title);
    header.appendChild(createStatusPill(`${themeLibrary.length} installed`, 'Bundled and Custom Theme Packs available in this settings profile.', { kind: 'count' }));
    panel.appendChild(header);

    const gallery = document.createElement('div');
    gallery.className = 'saga-theme-gallery';
    for (const preset of themeLibrary) {
        gallery.appendChild(createThemePackGalleryCard(preset, activePreset, settings, options));
    }
    gallery.appendChild(createThemeImportTile(options));
    panel.appendChild(gallery);
    return panel;
}

function createThemePackGalleryCard(preset, activePreset, settings = {}, options = {}) {
    const colors = preset.id === settings.themePackId ? getActiveThemeColors(settings) : completeThemeColors(preset.colors || {});
    const isActive = preset.id === activePreset?.id;
    const card = document.createElement('div');
    card.className = `saga-theme-pack-card${isActive ? ' saga-theme-pack-card-active' : ''}`;
    card.appendChild(createThemeEmblem(preset, colors));
    const main = document.createElement('div');
    main.className = 'saga-theme-pack-card-main';
    const title = document.createElement('div');
    title.className = 'saga-theme-pack-card-title';
    title.textContent = preset.title || preset.id;
    main.appendChild(title);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(preset.type === 'custom' ? 'Custom' : 'Bundled', 'Theme Pack source type.', { tone: 'source', kind: 'source' }));
    chips.appendChild(createStatusPill(getThemeStyleLabel(preset), 'Theme style metadata.', { tone: 'tag', kind: 'tag' }));
    main.appendChild(chips);
    main.appendChild(createThemeSwatchStrip(colors));
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const apply = createButton(isActive ? 'Active' : 'Apply', isActive ? 'This Theme Pack is active.' : 'Apply this Theme Pack.', () => {
        options.onApplyThemePreset?.(preset.id);
    }, isActive ? 'saga-primary-button' : '');
    apply.disabled = isActive;
    actions.appendChild(apply);
    main.appendChild(actions);
    card.appendChild(main);
    return card;
}

function createThemeImportTile(options = {}) {
    const tile = document.createElement('div');
    tile.className = 'saga-theme-import-tile';
    const icon = document.createElement('div');
    icon.className = 'saga-theme-import-icon';
    icon.textContent = '+';
    tile.appendChild(icon);
    const title = document.createElement('div');
    title.className = 'saga-theme-pack-card-title';
    title.textContent = 'Import Theme Pack';
    tile.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Import a JSON Theme Pack to add it to your library.';
    tile.appendChild(help);
    tile.appendChild(createButton('Import', 'Choose a Theme Pack JSON file.', () => {
        options.onImportThemePack?.();
    }));
    return tile;
}

export function createThemeIconSetPanel(activePreset, settings = {}, options = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-theme-panel saga-theme-icon-panel';
    const iconSet = getIconSetPreset(settings.themeIconSetId || DEFAULT_ICONSET_ID, settings);
    const iconItems = Array.isArray(options.iconItems) ? options.iconItems : [];
    const coverage = getThemeIconCoverage(iconSet, settings, iconItems);
    const header = document.createElement('div');
    header.className = 'saga-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Shelf Icon Set';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Current: ${iconSet.title || iconSet.id}`, 'Current reusable Icon Set selected independently from the active Theme Pack.', { tone: 'source', kind: 'source', maxChars: 42 }));
    panel.appendChild(header);

    const coverageText = `${coverage.loaded} / ${coverage.total} icon paths available | ${coverage.missing} using text fallback | ${coverage.invalid} invalid paths`;
    panel.appendChild(createStatusPill(coverageText, 'Icon Set coverage for the runtime shelf icons.', {
        tone: coverage.invalid ? 'danger' : (coverage.missing ? 'warning' : 'success'),
        kind: coverage.invalid || coverage.missing ? 'severity' : 'count',
        density: 'compact',
        className: 'saga-theme-icon-status',
        maxChars: 72,
    }));

    panel.appendChild(createThemeIconSetSelector(iconSet, settings, options));

    const grid = document.createElement('div');
    grid.className = 'saga-theme-icon-grid';
    for (const item of iconItems) {
        const tile = document.createElement('div');
        tile.className = 'saga-theme-icon-tile';
        const icon = document.createElement('div');
        icon.className = 'saga-theme-icon-preview';
        const path = getThemeIconPreviewPath(iconSet, item, settings);
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
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Import Icon Set', 'Import icon mappings as a Custom Icon Set.', () => {
        options.onImportIconSet?.();
    }));
    if (iconSet?.type === 'custom' && typeof options.onForgetIconSet === 'function') {
        actions.appendChild(createButton('Forget Icon Set', 'Remove this Custom Icon Set from installed settings.', async () => {
            await options.onForgetIconSet(iconSet.id);
        }));
    }
    actions.appendChild(createButton('Reset to Default', 'Switch to the bundled Saga Hero Icon Set.', () => {
        options.onApplyThemeIconSet?.(DEFAULT_ICONSET_ID);
    }));
    panel.appendChild(actions);

    const mapping = document.createElement('details');
    mapping.className = 'saga-theme-advanced-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced Icon Mapping';
    mapping.appendChild(summary);
    const rows = document.createElement('div');
    rows.className = 'saga-theme-icon-mapping';
    for (const item of iconItems) {
        rows.appendChild(createKeyValue(item.label, getThemeIconPreviewPath(iconSet, item, settings) || 'icon set fallback', 'Icon mapping path used by this Icon Set preview.'));
    }
    mapping.appendChild(rows);
    panel.appendChild(mapping);
    return panel;
}

function createThemeIconSetSelector(activeIconSet = getIconSetPreset(DEFAULT_ICONSET_ID), settings = {}, options = {}) {
    const iconSets = getIconSetLibrary(settings);
    const shell = document.createElement('div');
    shell.className = 'saga-theme-iconset-selector';

    const row = document.createElement('label');
    row.className = 'saga-theme-iconset-select-row';
    const label = document.createElement('span');
    label.textContent = 'Icon Set';
    addTooltip(label, 'Switch the runtime shelf tab icon library without changing colors or the active Theme Pack.');
    row.appendChild(label);

    const select = document.createElement('select');
    select.className = 'saga-lore-workbench-select saga-theme-iconset-select';
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
    strip.className = 'saga-theme-iconset-strip';
    for (const iconSet of iconSets) {
        const active = iconSet.id === activeIconSet.id;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `saga-theme-iconset-card${active ? ' saga-theme-iconset-card-active' : ''}`;
        card.disabled = active;
        addTooltip(card, active ? `${iconSet.title} is active.` : `Switch to ${iconSet.title}.`);
        card.addEventListener('click', () => options.onApplyThemeIconSet?.(iconSet.id));

        const preview = document.createElement('div');
        preview.className = 'saga-theme-iconset-preview-row';
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
    panel.className = 'saga-theme-panel saga-theme-overrides-panel';
    const header = document.createElement('div');
    header.className = 'saga-theme-panel-header';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Color Overrides';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Overrides: ${settings.themeCustomEnabled === true ? 'On' : 'Off'}`, 'Overrides are user color changes layered over the Theme Pack.', { tone: settings.themeCustomEnabled === true ? 'info' : 'muted', kind: 'status' }));
    panel.appendChild(header);

    if (settings.themeCustomEnabled !== true) {
        const empty = document.createElement('div');
        empty.className = 'saga-theme-overrides-empty';
        const emblem = document.createElement('div');
        emblem.className = 'saga-theme-header-icon';
        emblem.textContent = 'C';
        empty.appendChild(emblem);
        const text = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = 'Using pack defaults.';
        text.appendChild(title);
        const help = document.createElement('div');
        help.className = 'saga-runtime-help';
        help.textContent = 'Enable overrides to customize this theme without editing the original pack.';
        text.appendChild(help);
        empty.appendChild(text);
        panel.appendChild(empty);
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions';
        actions.appendChild(createButton('Enable Color Overrides', 'Enable editable color overrides layered on top of this Theme Pack.', () => {
            options.onEnableColorOverrides?.(activePreset);
        }, 'saga-primary-button'));
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
    panel.appendChild(createThemeColorGroup('Metadata Chips', colors, [
        ['Metadata', 'themeChipNeutralColor', 'chipNeutral'],
        ['Source / Tag', 'themeChipSourceColor', 'chipSource'],
        ['Info / Category', 'themeChipInfoColor', 'chipInfo'],
        ['Review / Selected', 'themeChipReviewColor', 'chipReview'],
        ['Success', 'themeChipSuccessColor', 'chipSuccess'],
        ['Warning', 'themeChipWarningColor', 'chipWarning'],
        ['Danger', 'themeChipDangerColor', 'chipDanger'],
        ['Muted', 'themeChipMutedColor', 'chipMuted'],
    ], options));
    panel.appendChild(createThemeColorGroup('Controls', colors, [
        ['Button', 'themeButtonColor', 'button'],
        ['Button Hover', 'themeButtonHoverColor', 'buttonHover'],
        ['Input', 'themeInputColor', 'input'],
        ['Input Border', 'themeInputBorderColor', 'inputBorder'],
    ], options));

    const advanced = document.createElement('details');
    advanced.className = 'saga-theme-advanced-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Advanced Tokens';
    advanced.appendChild(summary);
    const grid = document.createElement('div');
    grid.className = 'saga-theme-color-grid';
    for (const [label, settingKey, colorKey] of THEME_COLOR_FIELDS) {
        grid.appendChild(createThemeColorField(label, settingKey, colors[colorKey], true, options));
    }
    advanced.appendChild(grid);
    panel.appendChild(advanced);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
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
    group.className = 'saga-theme-color-group';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    group.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'saga-theme-color-grid';
    for (const [label, settingKey, colorKey] of fields) {
        grid.appendChild(createThemeColorField(label, settingKey, colors[colorKey], true, options));
    }
    group.appendChild(grid);
    return group;
}

function createThemeColorField(labelText, settingKey, value, enabled, options = {}) {
    const label = document.createElement('label');
    label.className = 'saga-theme-color-field';
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
    panel.className = 'saga-theme-panel saga-theme-advanced-panel';
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Advanced';
    summary.appendChild(title);
    const help = document.createElement('span');
    help.className = 'saga-runtime-help';
    help.textContent = 'Export raw tokens, inspect theme JSON, and manage diagnostics.';
    summary.appendChild(help);
    panel.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
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

export function getThemeIconPreviewPath(iconSet = {}, item = {}, settings = {}) {
    const icons = iconSet?.icons && typeof iconSet.icons === 'object' ? iconSet.icons : {};
    return getIconMapValue(icons, item.key)
        || getIconMapValue(icons, item.legacyKey)
        || normalizePassiveAssetPath(item.defaultPath || '');
}

export function getThemeIconCoverage(iconSet = {}, settings = {}, iconItems = []) {
    const items = Array.isArray(iconItems) ? iconItems : [];
    let loaded = 0;
    let invalid = 0;
    for (const item of items) {
        const path = getThemeIconPreviewPath(iconSet, item, settings);
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
    shell.className = `saga-theme-accessibility saga-theme-accessibility-${report.failedCount ? 'warning' : 'good'}${options.compact ? ' saga-theme-accessibility-compact' : ''}`;

    const header = document.createElement('div');
    header.className = 'saga-theme-accessibility-header';
    const title = document.createElement('strong');
    title.textContent = 'Accessibility';
    header.appendChild(title);
    header.appendChild(createStatusPill(`Overall: ${report.status}`, 'Theme contrast health is advisory and does not block use.', { tone: report.failedCount ? 'warning' : 'success', kind: 'severity' }));
    shell.appendChild(header);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = report.failedCount
        ? `${report.failedCount} contrast check${report.failedCount === 1 ? ' is' : 's are'} below the recommended threshold.`
        : 'All required contrast checks pass. Contrast checks use WCAG ratios.';
    shell.appendChild(help);

    const list = document.createElement('div');
    list.className = 'saga-theme-accessibility-list';
    const visibleChecks = options.compact
        ? (report.failedCount ? report.checks.filter(check => !check.passes) : [])
        : report.checks;
    for (const check of visibleChecks) {
        list.appendChild(createThemeAccessibilityRow(check));
    }
    shell.appendChild(list);

    if (options.compact && !report.failedCount) {
        const details = document.createElement('details');
        details.className = 'saga-theme-advanced-details';
        const summary = document.createElement('summary');
        summary.textContent = 'View Contrast Details';
        details.appendChild(summary);
        const detailList = document.createElement('div');
        detailList.className = 'saga-theme-accessibility-list';
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
    row.className = `saga-theme-accessibility-row ${check.passes ? 'saga-theme-accessibility-pass' : 'saga-theme-accessibility-fail'}`;

    const main = document.createElement('div');
    main.className = 'saga-theme-accessibility-main';
    const label = document.createElement('span');
    label.textContent = check.label || 'Contrast check';
    main.appendChild(label);
    const purpose = document.createElement('small');
    purpose.textContent = check.purpose || '';
    main.appendChild(purpose);
    row.appendChild(main);

    const score = createStatusPill(`${formatContrastRatio(check.ratio)} / ${check.target}:1`, check.passes ? 'Passes the advisory contrast target.' : 'Below the advisory contrast target.', {
        tone: check.passes ? 'success' : 'warning',
        kind: 'severity',
        density: 'compact',
        className: 'saga-theme-accessibility-score',
    });
    row.appendChild(score);
    return row;
}
