/**
 * Theme Pack and Icon Set library settings store.
 */

import { DEFAULT_SETTINGS } from './constants.js';

export const BUNDLED_THEME_PACK_IDS = Object.freeze([
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
    'radioactive-romance',
    'velvet-autopsy',
    'bubblegum-brutalist',
    'blacksite-mint',
    'fever-chapel',
]);

export const BUNDLED_THEME_ICON_SET_IDS = Object.freeze([
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
    'activate',
    'warning',
    'focus',
    'button',
    'buttonHover',
    'buttonText',
    'input',
    'inputBorder',
    'text',
    'mutedText',
    'chipNeutral',
    'chipSource',
    'chipInfo',
    'chipReview',
    'chipSuccess',
    'chipWarning',
    'chipDanger',
    'chipMuted',
]);

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

export function normalizeThemeIconSetRegistry(value, defaults = DEFAULT_SETTINGS.themeIconSetLibrary) {
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

export function normalizeThemePackRegistry(value, defaults = DEFAULT_SETTINGS.themePackLibrary) {
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

export function createThemeLibraryStore({ getSettings, saveSettings, defaultSettings = DEFAULT_SETTINGS } = {}) {
    const defaultThemePackLibrary = defaultSettings.themePackLibrary || DEFAULT_SETTINGS.themePackLibrary;
    const defaultThemeIconSetLibrary = defaultSettings.themeIconSetLibrary || DEFAULT_SETTINGS.themeIconSetLibrary;
    const readSettings = () => (typeof getSettings === 'function' ? getSettings() : {});
    const writeSettings = settings => {
        if (typeof saveSettings === 'function') saveSettings(settings);
    };

    return {
        getThemePackLibraryRegistry() {
            const settings = readSettings();
            return normalizeThemePackRegistry(settings.themePackLibrary, defaultThemePackLibrary);
        },

        getThemeIconSetLibraryRegistry() {
            const settings = readSettings();
            return normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, defaultThemeIconSetLibrary);
        },

        upsertThemePackLibraryPack(packRecord = {}) {
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

            const settings = readSettings();
            const library = normalizeThemePackRegistry(settings.themePackLibrary, defaultThemePackLibrary);
            library.packs[themeId] = {
                ...(library.packs[themeId] || {}),
                ...pack,
                installedAt: library.packs[themeId]?.installedAt || pack.installedAt || Date.now(),
                updatedAt: Date.now(),
            };
            settings.themePackLibrary = library;
            writeSettings(settings);
            return { ok: true, pack: library.packs[themeId], library };
        },

        removeThemePackLibraryPack(themeId, options = {}) {
            const id = String(themeId || '').trim();
            if (!id) return { ok: false, error: 'Missing Theme Pack id.' };
            if (options.allowBundled !== true && BUNDLED_THEME_PACK_IDS.includes(id)) {
                return { ok: false, error: 'Bundled Theme Packs cannot be removed from the library.' };
            }

            const settings = readSettings();
            const library = normalizeThemePackRegistry(settings.themePackLibrary, defaultThemePackLibrary);
            if (!library.packs[id]) return { ok: false, error: 'Theme Pack is not installed.' };
            delete library.packs[id];
            settings.themePackLibrary = normalizeThemePackRegistry(library, defaultThemePackLibrary);
            writeSettings(settings);
            return { ok: true, library: settings.themePackLibrary };
        },

        importThemePackLibraryRegistry(registry = {}, options = {}) {
            const incoming = normalizeThemePackRegistry(registry, { schemaVersion: 1, packs: {} });
            const rawPacks = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs) ? registry.packs : {};
            const settings = readSettings();
            const current = options.replace === true
                ? normalizeThemePackRegistry(defaultThemePackLibrary, defaultThemePackLibrary)
                : normalizeThemePackRegistry(settings.themePackLibrary, defaultThemePackLibrary);

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

            settings.themePackLibrary = normalizeThemePackRegistry(current, defaultThemePackLibrary);
            writeSettings(settings);
            return { ok: true, importedCount, skippedCount, library: settings.themePackLibrary };
        },

        upsertThemeIconSetLibraryPack(iconSetRecord = {}) {
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

            const settings = readSettings();
            const library = normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, defaultThemeIconSetLibrary);
            library.iconSets[iconSetId] = {
                ...(library.iconSets[iconSetId] || {}),
                ...iconSet,
                installedAt: library.iconSets[iconSetId]?.installedAt || iconSet.installedAt || Date.now(),
                updatedAt: Date.now(),
            };
            settings.themeIconSetLibrary = library;
            writeSettings(settings);
            return { ok: true, iconSet: library.iconSets[iconSetId], library };
        },

        removeThemeIconSetLibraryPack(iconSetId, options = {}) {
            const id = String(iconSetId || '').trim();
            if (!id) return { ok: false, error: 'Missing Icon Set id.' };
            if (options.allowBundled !== true && BUNDLED_THEME_ICON_SET_IDS.includes(id)) {
                return { ok: false, error: 'Bundled Icon Sets cannot be removed from the library.' };
            }

            const settings = readSettings();
            const library = normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, defaultThemeIconSetLibrary);
            if (!library.iconSets[id]) return { ok: false, error: 'Icon Set is not installed.' };
            delete library.iconSets[id];
            settings.themeIconSetLibrary = normalizeThemeIconSetRegistry(library, defaultThemeIconSetLibrary);
            writeSettings(settings);
            return { ok: true, library: settings.themeIconSetLibrary };
        },

        importThemeIconSetLibraryRegistry(registry = {}, options = {}) {
            const incoming = normalizeThemeIconSetRegistry(registry, { schemaVersion: 1, iconSets: {} });
            const settings = readSettings();
            const current = options.replace === true
                ? normalizeThemeIconSetRegistry(defaultThemeIconSetLibrary, defaultThemeIconSetLibrary)
                : normalizeThemeIconSetRegistry(settings.themeIconSetLibrary, defaultThemeIconSetLibrary);

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

            settings.themeIconSetLibrary = normalizeThemeIconSetRegistry(current, defaultThemeIconSetLibrary);
            writeSettings(settings);
            return { ok: true, importedCount, skippedCount, library: settings.themeIconSetLibrary };
        },
    };
}
