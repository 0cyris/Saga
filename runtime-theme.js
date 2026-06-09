/**
 * runtime-theme.js -- Saga
 * Runtime Theme Pack, Icon Set, passive asset, and contrast helpers.
 */

import { getSettings, getThemeIconSetLibraryRegistry, getThemePackLibraryRegistry } from './state-manager.js';

export const DEFAULT_ICONSET_ID = 'saga-hero';
const MYSTIC_ICONSET_ID = 'saga-mystic';
const RELAY_ICONSET_ID = 'saga-relay';

export const THEMEPACK_PRESETS = Object.freeze([
    {
        id: 'wandlight-default',
        type: 'bundled',
        title: 'SAGA Archive',
        description: 'Dark archive shelves, gold trim, parchment highlights, and polished fantasy UI.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#120c12',
            backgroundAlt: '#241018',
            gradientStart: '#120c12',
            gradientEnd: '#090c12',
            surface: '#2b1c1c',
            surfaceAlt: '#121218',
            border: '#b98b36',
            borderStrong: '#d7b56d',
            accent: '#d7b56d',
            danger: '#5c1724',
            success: '#1f4a38',
            warning: '#b9903c',
            focus: '#ffeaa7',
            button: '#18121a',
            buttonHover: '#5c1724',
            buttonText: '#f1ead8',
            input: '#121218',
            inputBorder: '#b98b36',
            text: '#f1ead8',
            mutedText: '#cfc5ad',
        },
        icons: {},
        tags: ['theme:dark', 'style:archive', 'genre:general', 'genre:fantasy', 'quality:bundled'],
    },
    {
        id: 'royal-chronicle',
        type: 'bundled',
        title: 'Royal Chronicle',
        description: 'High fantasy court records with royal blue panels, ivory text, wine shadows, and antique gold.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#0b1020',
            backgroundAlt: '#1d1024',
            gradientStart: '#0b1020',
            gradientEnd: '#2a1122',
            surface: '#18213a',
            surfaceAlt: '#101522',
            border: '#b89955',
            borderStrong: '#f0d58a',
            accent: '#f0d58a',
            danger: '#5a1930',
            success: '#1f5b45',
            warning: '#c7963e',
            focus: '#f5e5a6',
            button: '#141a2e',
            buttonHover: '#2f2340',
            buttonText: '#f7efd8',
            input: '#0f1423',
            inputBorder: '#b89955',
            text: '#f7efd8',
            mutedText: '#d8c99f',
        },
        icons: {},
        tags: ['theme:dark', 'style:royal', 'genre:high-fantasy', 'genre:politics', 'quality:bundled'],
    },
    {
        id: 'void-reliquary',
        type: 'bundled',
        title: 'Void Reliquary',
        description: 'Grimdark occult reliquary with ash-black steel, chapel greys, tarnished gold sigils, and blood-wax danger.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: MYSTIC_ICONSET_ID,
        colors: {
            background: '#070707',
            backgroundAlt: '#141414',
            gradientStart: '#070707',
            gradientEnd: '#191613',
            surface: '#1b1b1b',
            surfaceAlt: '#111111',
            border: '#7f6a32',
            borderStrong: '#d0ad4f',
            accent: '#d6b45a',
            danger: '#64161b',
            success: '#31533f',
            warning: '#c58b32',
            focus: '#f3d474',
            button: '#141414',
            buttonHover: '#2a2418',
            buttonText: '#f3ead4',
            input: '#101010',
            inputBorder: '#7f6a32',
            text: '#f3ead4',
            mutedText: '#c5bda8',
        },
        icons: {},
        tags: ['theme:dark', 'style:grimdark', 'style:occult', 'genre:dark-sci-fi', 'genre:gothic-horror', 'quality:bundled'],
    },
    {
        id: 'stellar-cartography',
        type: 'bundled',
        title: 'Stellar Cartography',
        description: 'Clean star maps, tactical blue-white lines, restrained command-console glow, and signal amber.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#07111f',
            backgroundAlt: '#102235',
            gradientStart: '#06101d',
            gradientEnd: '#071728',
            surface: '#11283a',
            surfaceAlt: '#081727',
            border: '#4ea3c7',
            borderStrong: '#91d8ff',
            accent: '#9bdcff',
            danger: '#532332',
            success: '#1d5a55',
            warning: '#d0a33f',
            focus: '#d4f2ff',
            button: '#0b1b2a',
            buttonHover: '#12334a',
            buttonText: '#eef7ff',
            input: '#071522',
            inputBorder: '#4ea3c7',
            text: '#eef7ff',
            mutedText: '#bdd5e3',
        },
        icons: {},
        tags: ['theme:dark', 'style:cartography', 'genre:sci-fi', 'genre:space-opera', 'quality:bundled'],
    },
    {
        id: 'neon-district',
        type: 'bundled',
        title: 'Neon District',
        description: 'Anime cybercity styling with cyan lanes, magenta shadows, electric yellow alerts, and concrete darks.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#090912',
            backgroundAlt: '#171021',
            gradientStart: '#0a0712',
            gradientEnd: '#091b23',
            surface: '#17172b',
            surfaceAlt: '#10101d',
            border: '#13d4d9',
            borderStrong: '#f2d75e',
            accent: '#44e4ff',
            danger: '#65133c',
            success: '#0e6d5b',
            warning: '#f2d75e',
            focus: '#ff66d8',
            button: '#111425',
            buttonHover: '#28203b',
            buttonText: '#f7f3ff',
            input: '#0d1020',
            inputBorder: '#13d4d9',
            text: '#f7f3ff',
            mutedText: '#c9c2df',
        },
        icons: {},
        tags: ['theme:dark', 'style:neon', 'genre:anime', 'genre:cyberpunk', 'quality:bundled'],
    },
    {
        id: 'hero-campus',
        type: 'bundled',
        title: 'Hero Campus',
        description: 'Bright shonen academy energy with varsity accents, training-board structure, and notebook clarity.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#0b1425',
            backgroundAlt: '#17203a',
            gradientStart: '#0b1425',
            gradientEnd: '#111c2e',
            surface: '#17253f',
            surfaceAlt: '#0f182a',
            border: '#f2c94c',
            borderStrong: '#fff1a8',
            accent: '#ffcf4d',
            danger: '#7c1f28',
            success: '#2c6b45',
            warning: '#ffb84d',
            focus: '#fff2a3',
            button: '#13203a',
            buttonHover: '#203455',
            buttonText: '#fff8e8',
            input: '#0f182a',
            inputBorder: '#f2c94c',
            text: '#fff8e8',
            mutedText: '#d9d4c4',
        },
        icons: {},
        tags: ['theme:dark', 'style:academy', 'genre:shonen', 'genre:superhero', 'quality:bundled'],
    },
    {
        id: 'sea-map-odyssey',
        type: 'bundled',
        title: 'Sea Map Odyssey',
        description: 'Adventure-map warmth with deep ocean panels, sunlit gold, coral danger, and dark ink readability.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#071925',
            backgroundAlt: '#0f3140',
            gradientStart: '#061823',
            gradientEnd: '#143a45',
            surface: '#133341',
            surfaceAlt: '#0c232f',
            border: '#d8a857',
            borderStrong: '#f3d48b',
            accent: '#f3c86a',
            danger: '#6a2a25',
            success: '#2f684a',
            warning: '#dba14a',
            focus: '#ffe09a',
            button: '#0d2835',
            buttonHover: '#164457',
            buttonText: '#f7efd8',
            input: '#0a2230',
            inputBorder: '#d8a857',
            text: '#f7efd8',
            mutedText: '#cfd8c3',
        },
        icons: {},
        tags: ['theme:dark', 'style:nautical', 'genre:adventure', 'genre:journey', 'quality:bundled'],
    },
    {
        id: 'monster-index',
        type: 'bundled',
        title: 'Monster Index',
        description: 'Creature encyclopedia and field-guide styling with forest panels, clay warmth, and taxonomy cues.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#08170f',
            backgroundAlt: '#13271b',
            gradientStart: '#08170f',
            gradientEnd: '#1e2c20',
            surface: '#162919',
            surfaceAlt: '#0e1d13',
            border: '#8fb06f',
            borderStrong: '#d5e8a8',
            accent: '#cde889',
            danger: '#653021',
            success: '#36744a',
            warning: '#caa24a',
            focus: '#e5f7b2',
            button: '#112216',
            buttonHover: '#223b29',
            buttonText: '#f6f0df',
            input: '#0d1d12',
            inputBorder: '#8fb06f',
            text: '#f6f0df',
            mutedText: '#d4d2b8',
        },
        icons: {},
        tags: ['theme:dark', 'style:field-guide', 'genre:creatures', 'genre:monster-catalog', 'quality:bundled'],
    },
    {
        id: 'holo-rail',
        type: 'bundled',
        title: 'Holo Rail',
        description: 'Luminous anime space-fantasy panels with champagne gold, aqua rails, and astral violet depth.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#0b0a18',
            backgroundAlt: '#17162f',
            gradientStart: '#0b0a18',
            gradientEnd: '#081c25',
            surface: '#181735',
            surfaceAlt: '#0f1024',
            border: '#7ddbd0',
            borderStrong: '#e5c779',
            accent: '#f1d18c',
            danger: '#5f2147',
            success: '#2c6254',
            warning: '#dba75c',
            focus: '#98fff2',
            button: '#12142b',
            buttonHover: '#262246',
            buttonText: '#faf4ff',
            input: '#0f1024',
            inputBorder: '#7ddbd0',
            text: '#faf4ff',
            mutedText: '#d5cceb',
        },
        icons: {},
        tags: ['theme:dark', 'style:holographic', 'genre:anime', 'genre:space-fantasy', 'quality:bundled'],
    },
    {
        id: 'midnight-evidence',
        type: 'bundled',
        title: 'Midnight Evidence',
        description: 'Investigation-board tension with case-file neutrals, desaturated greens, amber warnings, and rust-red danger.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#090d0c',
            backgroundAlt: '#131a17',
            gradientStart: '#090d0c',
            gradientEnd: '#15100c',
            surface: '#18211d',
            surfaceAlt: '#101613',
            border: '#8f6a3a',
            borderStrong: '#e0b86b',
            accent: '#e0b86b',
            danger: '#5b1b19',
            success: '#315f43',
            warning: '#c8892d',
            focus: '#ffd27a',
            button: '#111715',
            buttonHover: '#25312b',
            buttonText: '#f1f1e6',
            input: '#0f1512',
            inputBorder: '#8f6a3a',
            text: '#f1f1e6',
            mutedText: '#c7d0c2',
        },
        icons: {},
        tags: ['theme:dark', 'style:evidence', 'genre:mystery', 'genre:survival-horror', 'quality:bundled'],
    },
    {
        id: 'radioactive-romance',
        type: 'bundled',
        title: 'Radioactive Romance',
        description: 'Toxic love-story glow with fallout greens, oil-black panels, hot rose danger, and sickly warning light.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: MYSTIC_ICONSET_ID,
        colors: {
            background: '#090b06',
            backgroundAlt: '#17220d',
            gradientStart: '#090b06',
            gradientEnd: '#1f1510',
            surface: '#162016',
            surfaceAlt: '#10130c',
            border: '#a6ff3d',
            borderStrong: '#e6ff73',
            accent: '#c8ff4d',
            danger: '#9e123f',
            success: '#2f7d45',
            warning: '#ffc145',
            focus: '#f8ff7a',
            button: '#11180e',
            buttonHover: '#2b3615',
            buttonText: '#f6ffe8',
            input: '#0d120a',
            inputBorder: '#a6ff3d',
            text: '#f6ffe8',
            mutedText: '#c4d7a6',
        },
        icons: {},
        tags: ['theme:dark', 'style:toxic-glamour', 'genre:romance', 'genre:post-apocalyptic', 'quality:bundled'],
    },
    {
        id: 'velvet-autopsy',
        type: 'bundled',
        title: 'Velvet Autopsy',
        description: 'Surgical gothic styling with cold teal instruments, velvet-black surfaces, arterial danger, and forensic ivory text.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: MYSTIC_ICONSET_ID,
        colors: {
            background: '#0a0d0f',
            backgroundAlt: '#15111a',
            gradientStart: '#0a0d0f',
            gradientEnd: '#1b1118',
            surface: '#162024',
            surfaceAlt: '#0f1518',
            border: '#5ed6c2',
            borderStrong: '#b9fff0',
            accent: '#81f7d8',
            danger: '#7b1022',
            success: '#2a745d',
            warning: '#e2a83c',
            focus: '#ffe0b5',
            button: '#11191d',
            buttonHover: '#23242a',
            buttonText: '#f7efe2',
            input: '#0d1316',
            inputBorder: '#5ed6c2',
            text: '#f7efe2',
            mutedText: '#c8d6d0',
        },
        icons: {},
        tags: ['theme:dark', 'style:forensic-gothic', 'genre:horror', 'genre:medical-drama', 'quality:bundled'],
    },
    {
        id: 'bubblegum-brutalist',
        type: 'bundled',
        title: 'Bubblegum Brutalist',
        description: 'Punk zine contrast with concrete blacks, candy pink edges, cyan focus flashes, and comic-panel danger.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: DEFAULT_ICONSET_ID,
        colors: {
            background: '#0f0f10',
            backgroundAlt: '#201824',
            gradientStart: '#0f0f10',
            gradientEnd: '#141f25',
            surface: '#1b1c1f',
            surfaceAlt: '#141517',
            border: '#ff5c8a',
            borderStrong: '#ffc1d7',
            accent: '#ff7ab6',
            danger: '#b31942',
            success: '#3fa66b',
            warning: '#f6c845',
            focus: '#5be7ff',
            button: '#18191d',
            buttonHover: '#30202b',
            buttonText: '#fff7f8',
            input: '#131417',
            inputBorder: '#ff5c8a',
            text: '#fff7f8',
            mutedText: '#d4c5cc',
        },
        icons: {},
        tags: ['theme:dark', 'style:brutalist-pop', 'genre:punk', 'genre:superhero', 'quality:bundled'],
    },
    {
        id: 'blacksite-mint',
        type: 'bundled',
        title: 'Blacksite Mint',
        description: 'Classified terminal styling with blacksite greens, mint signal lines, restraint-room danger, and hard warning yellow.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: RELAY_ICONSET_ID,
        colors: {
            background: '#050a0a',
            backgroundAlt: '#0c1815',
            gradientStart: '#050a0a',
            gradientEnd: '#15180e',
            surface: '#101a19',
            surfaceAlt: '#0a1111',
            border: '#217b68',
            borderStrong: '#6df7c9',
            accent: '#49f0bc',
            danger: '#811d16',
            success: '#2e8a63',
            warning: '#d7b84a',
            focus: '#d9ff66',
            button: '#0b1414',
            buttonHover: '#162321',
            buttonText: '#eafff7',
            input: '#081010',
            inputBorder: '#217b68',
            text: '#eafff7',
            mutedText: '#b6cdc4',
        },
        icons: {},
        tags: ['theme:dark', 'style:blacksite', 'genre:spycraft', 'genre:techno-thriller', 'quality:bundled'],
    },
    {
        id: 'fever-chapel',
        type: 'bundled',
        title: 'Fever Chapel',
        description: 'Candlelit cult-drama warmth with scorched chapel surfaces, sacred gold, fever-red danger, and ritual focus light.',
        author: 'Saga',
        version: '1.0.0',
        iconPackId: MYSTIC_ICONSET_ID,
        colors: {
            background: '#100b0a',
            backgroundAlt: '#24120d',
            gradientStart: '#100b0a',
            gradientEnd: '#25120d',
            surface: '#221715',
            surfaceAlt: '#160f0e',
            border: '#b06a2c',
            borderStrong: '#ffd15f',
            accent: '#ffb000',
            danger: '#8f112d',
            success: '#3d7a4f',
            warning: '#e58f2f',
            focus: '#fff06a',
            button: '#1a1110',
            buttonHover: '#331a13',
            buttonText: '#fff1dc',
            input: '#140e0d',
            inputBorder: '#b06a2c',
            text: '#fff1dc',
            mutedText: '#dac8b5',
        },
        icons: {},
        tags: ['theme:dark', 'style:ritual', 'genre:occult', 'genre:gothic-drama', 'quality:bundled'],
    },
]);

export const THEME_COLOR_FIELDS = Object.freeze([
    ['Background', 'themeBackgroundColor', 'background'],
    ['Background Alt', 'themeBackgroundAltColor', 'backgroundAlt'],
    ['Gradient Start', 'themeGradientStartColor', 'gradientStart'],
    ['Gradient End', 'themeGradientEndColor', 'gradientEnd'],
    ['Surface', 'themeSurfaceColor', 'surface'],
    ['Surface Alt', 'themeSurfaceAltColor', 'surfaceAlt'],
    ['Border', 'themeBorderColor', 'border'],
    ['Strong Border', 'themeBorderStrongColor', 'borderStrong'],
    ['Accent', 'themeAccentColor', 'accent'],
    ['Danger', 'themeDangerColor', 'danger'],
    ['Success', 'themeSuccessColor', 'success'],
    ['Warning', 'themeWarningColor', 'warning'],
    ['Focus', 'themeFocusColor', 'focus'],
    ['Button', 'themeButtonColor', 'button'],
    ['Button Hover', 'themeButtonHoverColor', 'buttonHover'],
    ['Button Text', 'themeButtonTextColor', 'buttonText'],
    ['Input', 'themeInputColor', 'input'],
    ['Input Border', 'themeInputBorderColor', 'inputBorder'],
    ['Text', 'themeTextColor', 'text'],
    ['Muted Text', 'themeMutedTextColor', 'mutedText'],
]);

export const TAB_ICON_PATHS = {
    loredecks: './Images/iconsets/saga-hero/hero-tab-loredecks-256.png',
    session: './Images/iconsets/saga-hero/hero-tab-session-256.png',
    context: './Images/iconsets/saga-hero/hero-tab-context-256.png',
    continuity: './Images/iconsets/saga-hero/hero-tab-continuity-256.png',
    lore: './Images/iconsets/saga-hero/hero-tab-lorecards-256.png',
    injection: './Images/iconsets/saga-hero/hero-tab-injection-256.png',
    settings: './Images/iconsets/saga-hero/hero-tab-settings-256.png',
};

export const BRAND_LOGO_PATHS = {
    compact: './Images/branding/saga-s-256.png',
    expanded: './Images/branding/saga-banner-512.png',
};

const ICONSET_SCHEMA_VERSION = 1;
const ICONSET_TARGET_ALIASES = Object.freeze({
    'tab.loredecks': 'tab.loredecks',
    'tab.lorecards': 'tab.lore',
    loredecks: 'tab.loredecks',
    lorecards: 'tab.lore',
    loredecks: 'tab.loredecks',
    session: 'tab.session',
    context: 'tab.context',
    continuity: 'tab.continuity',
    lore: 'tab.lore',
    injection: 'tab.injection',
    settings: 'tab.settings',
    collapse: 'control.collapse',
});

export const BUNDLED_ICONSET_PRESETS = Object.freeze([
    {
        schemaVersion: ICONSET_SCHEMA_VERSION,
        id: DEFAULT_ICONSET_ID,
        type: 'bundled',
        title: 'Saga Hero',
        description: 'Heroic Saga runtime shelf icons with fuller illustrated tab emblems.',
        author: 'Saga',
        version: '1.0.0',
        preferredSize: 256,
        icons: {
            'tab.loredecks': './Images/iconsets/saga-hero/hero-tab-loredecks-256.png',
            'tab.session': './Images/iconsets/saga-hero/hero-tab-session-256.png',
            'tab.context': './Images/iconsets/saga-hero/hero-tab-context-256.png',
            'tab.continuity': './Images/iconsets/saga-hero/hero-tab-continuity-256.png',
            'tab.lore': './Images/iconsets/saga-hero/hero-tab-lorecards-256.png',
            'tab.injection': './Images/iconsets/saga-hero/hero-tab-injection-256.png',
            'tab.settings': './Images/iconsets/saga-hero/hero-tab-settings-256.png',
            'brand.compact': BRAND_LOGO_PATHS.compact,
            'brand.expanded': BRAND_LOGO_PATHS.expanded,
        },
        tags: ['iconset:runtime', 'style:saga-hero', 'quality:bundled'],
    },
    {
        schemaVersion: ICONSET_SCHEMA_VERSION,
        id: MYSTIC_ICONSET_ID,
        type: 'bundled',
        title: 'Saga Mystic',
        description: 'Fantasy Saga runtime shelf icons with arcane, gilded, storybook tab emblems.',
        author: 'Saga',
        version: '1.0.0',
        preferredSize: 256,
        icons: {
            'tab.loredecks': './Images/iconsets/saga-mystic/mystic-tab-loredecks-256.png',
            'tab.session': './Images/iconsets/saga-mystic/mystic-tab-session-256.png',
            'tab.context': './Images/iconsets/saga-mystic/mystic-tab-context-256.png',
            'tab.continuity': './Images/iconsets/saga-mystic/mystic-tab-continuity-256.png',
            'tab.lore': './Images/iconsets/saga-mystic/mystic-tab-lorecards-256.png',
            'tab.injection': './Images/iconsets/saga-mystic/mystic-tab-injection-256.png',
            'tab.settings': './Images/iconsets/saga-mystic/mystic-tab-settings-256.png',
            'brand.compact': BRAND_LOGO_PATHS.compact,
            'brand.expanded': BRAND_LOGO_PATHS.expanded,
        },
        tags: ['iconset:runtime', 'style:saga-mystic', 'genre:fantasy', 'quality:bundled'],
    },
    {
        schemaVersion: ICONSET_SCHEMA_VERSION,
        id: RELAY_ICONSET_ID,
        type: 'bundled',
        title: 'Saga Relay',
        description: 'Sci-fi Saga runtime shelf icons with signal, console, and starship-interface tab emblems.',
        author: 'Saga',
        version: '1.0.0',
        preferredSize: 256,
        icons: {
            'tab.loredecks': './Images/iconsets/saga-relay/relay-tab-loredecks-256.png',
            'tab.session': './Images/iconsets/saga-relay/relay-tab-session-256.png',
            'tab.context': './Images/iconsets/saga-relay/relay-tab-context-256.png',
            'tab.continuity': './Images/iconsets/saga-relay/relay-tab-continuity-256.png',
            'tab.lore': './Images/iconsets/saga-relay/relay-tab-lorecards-256.png',
            'tab.injection': './Images/iconsets/saga-relay/relay-tab-injection-256.png',
            'tab.settings': './Images/iconsets/saga-relay/relay-tab-settings-256.png',
            'brand.compact': BRAND_LOGO_PATHS.compact,
            'brand.expanded': BRAND_LOGO_PATHS.expanded,
        },
        tags: ['iconset:runtime', 'style:saga-relay', 'genre:sci-fi', 'quality:bundled'],
    },
]);

const PASSIVE_IMAGE_ASSET_PATTERN = /\.(png|jpe?g|webp)$/i;

export function getLocalAssetSrc(assetPath) {
    if (!assetPath) return '';
    try {
        return new URL(assetPath, import.meta.url).href;
    } catch (error) {
        return assetPath;
    }
}

export function normalizePassiveAssetPath(value = '') {
    const path = String(value || '').trim();
    if (!path) return '';
    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(path)) return path;
    if (/^https?:\/\//i.test(path)) return path;
    if (/^(?:javascript|data:text|file|vbscript):/i.test(path)) return '';
    if (/^[a-z]:/i.test(path) || path.startsWith('/')) return '';
    if (path.includes('\\') || path.split('/').some(part => part === '..')) return '';
    if (!PASSIVE_IMAGE_ASSET_PATTERN.test(path)) return '';
    return path;
}

export function normalizeAssetRef(ref = null) {
    if (!ref) return null;
    const raw = typeof ref === 'string'
        ? { path: ref }
        : (typeof ref === 'object' && !Array.isArray(ref) ? ref : null);
    if (!raw) return null;
    const path = normalizePassiveAssetPath(raw.path || raw.url || raw.dataUrl || raw.src || '');
    if (!path) return null;
    const asset = {
        path,
        alt: String(raw.alt || '').trim().slice(0, 240),
        title: String(raw.title || '').trim().slice(0, 160),
        aspect: String(raw.aspect || '').trim().slice(0, 40),
    };
    const fit = String(raw.fit || raw.objectFit || '').trim().toLowerCase();
    if (fit === 'contain' || fit === 'cover') asset.fit = fit;
    const width = Number(raw.width);
    const height = Number(raw.height);
    if (Number.isFinite(width) && width > 0) asset.width = Math.round(width);
    if (Number.isFinite(height) && height > 0) asset.height = Math.round(height);
    if (raw.mimeType) asset.mimeType = String(raw.mimeType || '').trim().slice(0, 80);
    if (Number.isFinite(Number(raw.updatedAt))) asset.updatedAt = Number(raw.updatedAt);
    if (raw.focalPoint && typeof raw.focalPoint === 'object' && !Array.isArray(raw.focalPoint)) {
        const x = Number(raw.focalPoint.x);
        const y = Number(raw.focalPoint.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            asset.focalPoint = {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
            };
        }
    }
    return asset;
}

export function getAssetSrc(ref = null) {
    const asset = normalizeAssetRef(ref);
    return asset ? getLocalAssetSrc(asset.path) : '';
}

function normalizeIconTargetKey(iconKey = '') {
    const raw = String(iconKey || '').trim();
    if (!raw) return '';
    const canonical = ICONSET_TARGET_ALIASES[raw] || raw;
    if (canonical.startsWith('tab.') || canonical.startsWith('brand.') || canonical.startsWith('control.')) return canonical;
    return ICONSET_TARGET_ALIASES[canonical] || canonical;
}

export function getIconSetLibrary(settings = getSettings()) {
    const registry = settings?.themeIconSetLibrary || getThemeIconSetLibraryRegistry();
    const customIconSets = Object.values(registry?.iconSets || {})
        .filter(iconSet => iconSet && typeof iconSet === 'object')
        .map(iconSet => ({
            schemaVersion: ICONSET_SCHEMA_VERSION,
            id: iconSet.id,
            type: iconSet.type === 'bundled' ? 'bundled' : 'custom',
            title: iconSet.title || iconSet.id,
            description: iconSet.description || '',
            author: iconSet.author || '',
            version: iconSet.version || '',
            preferredSize: iconSet.preferredSize || 256,
            icons: { ...(iconSet.icons || {}) },
            tags: Array.isArray(iconSet.tags) ? [...iconSet.tags] : ['icons:custom'],
            source: iconSet.source || {},
        }));
    const bundledIds = new Set(BUNDLED_ICONSET_PRESETS.map(pack => pack.id));
    return [
        ...BUNDLED_ICONSET_PRESETS,
        ...customIconSets.filter(pack => !bundledIds.has(pack.id)),
    ];
}

export function getIconSetPreset(iconPackId = '', settings = getSettings()) {
    const id = String(iconPackId || '').trim();
    return getIconSetLibrary(settings).find(pack => pack.id === id) || BUNDLED_ICONSET_PRESETS[0];
}

export function getIconMapValue(icons = {}, iconKey = '') {
    const canonical = normalizeIconTargetKey(iconKey);
    if (!canonical || !icons || typeof icons !== 'object') return '';
    const aliases = new Set([canonical, iconKey, ...Object.entries(ICONSET_TARGET_ALIASES)
        .filter(([, value]) => value === canonical)
        .map(([key]) => key)]);
    for (const key of aliases) {
        const value = normalizePassiveAssetPath(icons[key]);
        if (value) return value;
    }
    return '';
}

export function resolveThemeIconPath(iconKey, preset = getThemePreset(getSettings().themePackId), settings = getSettings()) {
    const iconSet = getIconSetPreset(settings.themeIconPackId || DEFAULT_ICONSET_ID, settings);
    const iconSetPath = getIconMapValue(iconSet.icons, iconKey);
    if (iconSetPath) return iconSetPath;
    const defaultSet = getIconSetPreset(DEFAULT_ICONSET_ID, settings);
    const defaultPath = getIconMapValue(defaultSet.icons, iconKey);
    if (defaultPath) return defaultPath;
    return '';
}

export function getTabIconSrc(tabId, settings = getSettings()) {
    const themedIcon = getThemeIconPath(`tab.${tabId}`, settings) || getThemeIconPath(tabId, settings);
    return getLocalAssetSrc(themedIcon || TAB_ICON_PATHS[tabId]);
}

export function getBrandLogoSrc(railMode, settings = getSettings()) {
    const key = String(railMode || '').trim() === 'expanded' ? 'expanded' : 'compact';
    const themedIcon = getThemeIconPath(`brand.${key}`, settings) || getThemeIconPath(`brand.${railMode}`, settings);
    return getLocalAssetSrc(themedIcon || BRAND_LOGO_PATHS[key]);
}

export function normalizeHexColor(value, fallback = '#000000') {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
    }
    return fallback;
}

function hexToRgba(hex, alpha = 1) {
    const color = normalizeHexColor(hex, '#000000').slice(1);
    const value = parseInt(color, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    const a = Math.max(0, Math.min(1, Number(alpha)));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function getThemePackLibrary(settings = getSettings()) {
    const registry = settings?.themePackLibrary || getThemePackLibraryRegistry();
    const customPacks = Object.values(registry?.packs || {})
        .filter(pack => pack && typeof pack === 'object')
        .filter(pack => {
            const tags = Array.isArray(pack.tags) ? pack.tags.map(tag => String(tag || '').trim().toLowerCase()) : [];
            return !tags.includes('theme:icon-set') && !tags.includes('icons:custom');
        })
        .map(pack => ({
            ...pack,
            type: pack.type === 'bundled' ? 'bundled' : 'custom',
            colors: { ...(pack.colors || {}) },
            icons: { ...(pack.icons || {}) },
            tags: Array.isArray(pack.tags) ? [...pack.tags] : [],
        }));
    return [
        ...THEMEPACK_PRESETS,
        ...customPacks.filter(pack => !THEMEPACK_PRESETS.some(preset => preset.id === pack.id)),
    ];
}

export function getThemePreset(id, settings = getSettings()) {
    return getThemePackLibrary(settings).find(theme => theme.id === id) || THEMEPACK_PRESETS[0];
}

export function getThemeIconPath(iconKey, settings = getSettings()) {
    const preset = getThemePreset(settings.themePackId, settings);
    return resolveThemeIconPath(iconKey, preset, settings);
}

export function completeThemeColors(colors = {}) {
    const fallback = THEMEPACK_PRESETS[0].colors;
    const merged = {
        ...fallback,
        ...colors,
    };
    merged.gradientStart = merged.gradientStart || merged.background;
    merged.gradientEnd = merged.gradientEnd || merged.backgroundAlt || merged.background;
    merged.borderStrong = merged.borderStrong || merged.border;
    merged.button = merged.button || merged.surfaceAlt || merged.surface;
    merged.buttonHover = merged.buttonHover || merged.backgroundAlt || merged.button;
    merged.buttonText = merged.buttonText || merged.text;
    merged.input = merged.input || merged.surfaceAlt || merged.surface;
    merged.inputBorder = merged.inputBorder || merged.border;
    merged.focus = merged.focus || merged.accent;
    merged.success = merged.success || '#1f4a38';
    merged.warning = merged.warning || merged.accent;

    const output = {};
    for (const [, , colorKey] of THEME_COLOR_FIELDS) {
        output[colorKey] = normalizeHexColor(merged[colorKey], fallback[colorKey] || '#000000');
    }
    return output;
}

export function getActiveThemeColors(settings = getSettings()) {
    const preset = getThemePreset(settings.themePackId, settings);
    const colors = completeThemeColors(preset?.colors || {});
    if (settings.themeCustomEnabled === true) {
        for (const [, settingKey, colorKey] of THEME_COLOR_FIELDS) {
            colors[colorKey] = normalizeHexColor(settings[settingKey], colors[colorKey]);
        }
    }
    return completeThemeColors(colors);
}

export function writeThemeColorsToSettings(settings, colors = {}) {
    const complete = completeThemeColors(colors);
    for (const [, settingKey, colorKey] of THEME_COLOR_FIELDS) {
        settings[settingKey] = complete[colorKey];
    }
    return settings;
}

function writeRuntimeThemeVars(target, colors) {
    if (!target?.style) return;
    target.style.setProperty('--wandlight-bg', hexToRgba(colors.background, 0.97));
    target.style.setProperty('--wandlight-bg-2', hexToRgba(colors.backgroundAlt, 0.94));
    target.style.setProperty('--wandlight-bg-gradient-start', hexToRgba(colors.gradientStart, 0.985));
    target.style.setProperty('--wandlight-bg-gradient-end', hexToRgba(colors.gradientEnd, 0.98));
    target.style.setProperty('--wandlight-surface', hexToRgba(colors.surface, 0.74));
    target.style.setProperty('--wandlight-surface-2', hexToRgba(colors.surfaceAlt, 0.62));
    target.style.setProperty('--wandlight-border', hexToRgba(colors.border, 0.38));
    target.style.setProperty('--wandlight-border-soft', hexToRgba(colors.border, 0.18));
    target.style.setProperty('--wandlight-border-strong', hexToRgba(colors.borderStrong, 0.58));
    target.style.setProperty('--wandlight-gold', colors.accent);
    target.style.setProperty('--wandlight-gold-soft', hexToRgba(colors.accent, 0.74));
    target.style.setProperty('--wandlight-gold-surface', hexToRgba(colors.accent, 0.12));
    target.style.setProperty('--wandlight-red', colors.danger);
    target.style.setProperty('--wandlight-red-soft', hexToRgba(colors.danger, 0.42));
    target.style.setProperty('--wandlight-red-surface', hexToRgba(colors.danger, 0.24));
    target.style.setProperty('--wandlight-red-hover', hexToRgba(colors.danger, 0.34));
    target.style.setProperty('--wandlight-green', colors.success);
    target.style.setProperty('--wandlight-green-soft', hexToRgba(colors.success, 0.42));
    target.style.setProperty('--wandlight-warning', colors.warning);
    target.style.setProperty('--wandlight-warning-soft', hexToRgba(colors.warning, 0.42));
    target.style.setProperty('--wandlight-focus', colors.focus);
    target.style.setProperty('--wandlight-button', hexToRgba(colors.button, 0.82));
    target.style.setProperty('--wandlight-button-hover', hexToRgba(colors.buttonHover, 0.82));
    target.style.setProperty('--wandlight-button-text', colors.buttonText);
    target.style.setProperty('--wandlight-input', hexToRgba(colors.input, 0.76));
    target.style.setProperty('--wandlight-input-border', hexToRgba(colors.inputBorder, 0.34));
    target.style.setProperty('--wandlight-text', colors.text);
    target.style.setProperty('--wandlight-muted', hexToRgba(colors.mutedText, 0.68));
    target.style.setProperty('--wandlight-text-muted', hexToRgba(colors.mutedText, 0.68));
}

export function applyRuntimeTheme(root, settings = getSettings()) {
    const colors = getActiveThemeColors(settings);
    writeRuntimeThemeVars(root, colors);
    if (typeof document !== 'undefined') {
        writeRuntimeThemeVars(document.documentElement, colors);
        writeRuntimeThemeVars(document.body, colors);
    }
}

function hexToRgbParts(hex) {
    const color = normalizeHexColor(hex, '#000000').slice(1);
    const value = parseInt(color, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

function getRelativeLuminance(hex) {
    const { r, g, b } = hexToRgbParts(hex);
    const convert = (channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return (0.2126 * convert(r)) + (0.7152 * convert(g)) + (0.0722 * convert(b));
}

function getContrastRatio(foreground, background) {
    const fg = getRelativeLuminance(foreground);
    const bg = getRelativeLuminance(background);
    const lighter = Math.max(fg, bg);
    const darker = Math.min(fg, bg);
    return (lighter + 0.05) / (darker + 0.05);
}

export function formatContrastRatio(value) {
    return `${Math.round(Number(value || 0) * 10) / 10}:1`;
}

export function buildThemeAccessibilityReport(colors = {}) {
    const complete = completeThemeColors(colors);
    const checks = [
        { key: 'body', label: 'Body Text', foreground: complete.text, background: complete.background, target: 4.5, purpose: 'Primary runtime text.' },
        { key: 'muted', label: 'Muted Text', foreground: complete.mutedText, background: complete.surface, target: 4.5, purpose: 'Secondary labels and help text.' },
        { key: 'button', label: 'Button Text', foreground: complete.buttonText, background: complete.button, target: 4.5, purpose: 'Action buttons.' },
        { key: 'accent', label: 'Accent Controls', foreground: complete.accent, background: complete.background, target: 3, purpose: 'Selected tabs, links, and highlights.' },
        { key: 'focus', label: 'Focus Ring', foreground: complete.focus, background: complete.background, target: 3, purpose: 'Keyboard focus visibility.' },
        { key: 'danger', label: 'Danger Surface', foreground: complete.text, background: complete.danger, target: 4.5, purpose: 'Danger-zone controls and warnings.' },
    ].map(check => {
        const ratio = getContrastRatio(check.foreground, check.background);
        return {
            ...check,
            ratio,
            passes: ratio >= check.target,
        };
    });

    const failed = checks.filter(check => !check.passes);
    return {
        status: failed.length ? 'Needs Attention' : 'Good',
        failedCount: failed.length,
        checks,
    };
}
