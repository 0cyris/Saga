import {
    BASIC_EXPERIENCE_MANAGED_SETTING_KEYS,
    BASIC_EXPERIENCE_PROFILE_VERSION,
    BASIC_EXPERIENCE_SETTINGS,
    DEFAULT_SETTINGS,
} from '../state/constants.js';
import { normalizeExperienceMode } from './runtime-navigation.js';

export function pickManagedExperienceSettings(settings = {}) {
    const backup = {};
    for (const key of BASIC_EXPERIENCE_MANAGED_SETTING_KEYS) {
        if (Object.prototype.hasOwnProperty.call(settings, key)) backup[key] = settings[key];
    }
    return backup;
}

export function applyExperienceModeSettings(settings = {}, mode = 'basic') {
    const normalized = normalizeExperienceMode(mode);
    const current = normalizeExperienceMode(settings.experienceMode);
    if (current === normalized) return { changed: false, mode: normalized, settings };

    if (normalized === 'basic') {
        settings.advancedExperienceSettingsBackup = pickManagedExperienceSettings(settings);
        Object.assign(settings, BASIC_EXPERIENCE_SETTINGS);
        settings.experienceMode = 'basic';
        settings.basicExperienceProfileVersion = BASIC_EXPERIENCE_PROFILE_VERSION;
        return { changed: true, mode: normalized, settings };
    }

    const backup = settings.advancedExperienceSettingsBackup && typeof settings.advancedExperienceSettingsBackup === 'object' && !Array.isArray(settings.advancedExperienceSettingsBackup)
        ? settings.advancedExperienceSettingsBackup
        : {};
    for (const key of BASIC_EXPERIENCE_MANAGED_SETTING_KEYS) {
        if (Object.prototype.hasOwnProperty.call(backup, key)) {
            settings[key] = backup[key];
        } else if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
            settings[key] = DEFAULT_SETTINGS[key];
        }
    }
    settings.experienceMode = 'advanced';
    settings.workflowMode = settings.automationMode || settings.workflowMode || 'manual';
    return { changed: true, mode: normalized, settings };
}
