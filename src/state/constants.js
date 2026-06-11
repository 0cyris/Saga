/**
 * constants.js - Saga
 * Public constants facade. Keep imports stable while defaults are split into
 * focused modules.
 */

export {
    MODULE_KEY,
    SCHEMA_VERSION,
} from './schema.js';

export {
    EXTENSION_FOLDER,
    detectExtensionFolder,
    LOG_PREFIX,
} from './ui-defaults.js';

export {
    SAGA_PROVIDER_PRESET_NAME,
    SAGA_PROVIDER_PRESET_VERSION,
    SAGA_PROVIDER_PRESET_ASSET_PATH,
} from './provider-defaults.js';

export {
    AUTOMATION_MODE_VALUES,
    EXPERIENCE_MODE_VALUES,
    BASIC_EXPERIENCE_PROFILE_VERSION,
    BASIC_EXPERIENCE_SETTINGS,
    BASIC_EXPERIENCE_MANAGED_SETTING_KEYS,
} from './basic-profile.js';

export { DEFAULT_SETTINGS } from './default-settings.js';
export { getDefaultState } from './default-state.js';

export {
    LORE_CONTEXT_DETECTION_SYSTEM_PROMPT,
    JSON_REPAIR_SYSTEM_PROMPT,
    MEMO_MAX_TOKENS,
    MAX_PRESENT_CHARS_IN_MEMO,
    MAX_KNOWLEDGE_FACTS_PER_CHAR,
    MAX_ACTIVE_THREADS_IN_MEMO,
    MAX_RELATIONSHIPS_IN_MEMO,
    MAX_FLAGS_IN_MEMO,
} from './prompt-defaults.js';
